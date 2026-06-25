'use strict';

const mongoose = require('mongoose');
const DistributorDispatch = require('../models/DistributorDispatch');
const DistributorReturn   = require('../models/DistributorReturn');
const Distributor         = require('../models/Distributor');
const Product             = require('../models/Product');

// ── Shared aggregation helper: lookup approved returns per (dist, prod, batch) ──
function returnLookupStage() {
  return {
    $lookup: {
      from: 'distributorreturns',
      let: { dist: '$_id.distributor', prod: '$_id.product', batch: '$_id.batchNumber' },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ['$distributor', '$$dist'] },
                { $eq: ['$product',     '$$prod'] },
                { $eq: ['$batchNumber', '$$batch'] },
                { $eq: ['$returnStatus', 'Approved'] }
              ]
            }
          }
        },
        { $group: { _id: null, totalReturned: { $sum: '$quantityReturned' } } }
      ],
      as: 'returnData'
    }
  };
}

function calcRemainingStage() {
  return {
    $addFields: {
      totalReturned: { $ifNull: [{ $first: '$returnData.totalReturned' }, 0] },
      remaining: {
        $subtract: [
          '$totalSent',
          { $ifNull: [{ $first: '$returnData.totalReturned' }, 0] }
        ]
      }
    }
  };
}

function statusExpr() {
  return {
    $switch: {
      branches: [
        { case: { $lte: ['$remaining', 0] },  then: 'No Stock'  },
        { case: { $lte: ['$remaining', 50] }, then: 'Low Stock' }
      ],
      default: 'In Stock'
    }
  };
}

// ────────────────────────────────────────────────────────────────────────────────
// GET /api/dist-inventory/dashboard
// ────────────────────────────────────────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const [dispatchStats, returnStats, activeResult] = await Promise.all([
      DistributorDispatch.aggregate([
        {
          $group: {
            _id: null,
            totalSent:      { $sum: '$quantitySent' },
            uniqueProducts: { $addToSet: '$product' }
          }
        }
      ]),
      DistributorReturn.aggregate([
        { $match: { returnStatus: 'Approved' } },
        {
          $group: {
            _id: null,
            totalReturned:   { $sum: '$quantityReturned' },
            uniqueReturned:  { $addToSet: '$product' }
          }
        }
      ]),
      // Count (dist, product, batch) combos where remaining > 0
      DistributorDispatch.aggregate([
        {
          $group: {
            _id:        { distributor: '$distributor', product: '$product', batchNumber: '$batchNumber' },
            totalSent:  { $sum: '$quantitySent' }
          }
        },
        returnLookupStage(),
        calcRemainingStage(),
        { $match: { remaining: { $gt: 0 } } },
        { $group: { _id: null, activeCount: { $sum: 1 } } }
      ])
    ]);

    const totalSent      = dispatchStats[0]?.totalSent     || 0;
    const totalReturned  = returnStats[0]?.totalReturned   || 0;
    const activeProducts = activeResult[0]?.activeCount    || 0;

    res.json({
      success: true,
      data: {
        totalProductsSent:     totalSent,
        totalProductsReturned: totalReturned,
        currentRemainingStock: totalSent - totalReturned,
        totalActiveProducts:   activeProducts
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ────────────────────────────────────────────────────────────────────────────────
// GET /api/dist-inventory/inventory
// Query: search, distributorId, status (in-stock|low-stock|no-stock), page, limit
// ────────────────────────────────────────────────────────────────────────────────
exports.getInventory = async (req, res) => {
  try {
    const {
      search = '',
      distributorId = '',
      status = '',
      page  = 1,
      limit = 20
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const dispatchMatch = {};

    if (distributorId && mongoose.isValidObjectId(distributorId)) {
      dispatchMatch.distributor = new mongoose.Types.ObjectId(distributorId);
    }

    const statusFilter =
      status === 'in-stock'  ? [{ $match: { remaining: { $gt: 50 } } }] :
      status === 'low-stock' ? [{ $match: { remaining: { $gt: 0, $lte: 50 } } }] :
      status === 'no-stock'  ? [{ $match: { remaining: { $lte: 0 } } }] : [];

    const searchFilter = search
      ? [{
          $match: {
            $or: [
              { 'productInfo.name':    { $regex: search, $options: 'i' } },
              { '_id.batchNumber':     { $regex: search, $options: 'i' } },
              { 'distributorInfo.name':{ $regex: search, $options: 'i' } }
            ]
          }
        }]
      : [];

    const pipeline = [
      ...(Object.keys(dispatchMatch).length ? [{ $match: dispatchMatch }] : []),
      {
        $group: {
          _id:          { distributor: '$distributor', product: '$product', batchNumber: '$batchNumber' },
          totalSent:    { $sum: '$quantitySent' },
          lastDispatch: { $max: '$dispatchDate' }
        }
      },
      returnLookupStage(),
      calcRemainingStage(),
      {
        $lookup: {
          from:         'products',
          localField:   '_id.product',
          foreignField: '_id',
          as:           'productInfo'
        }
      },
      { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from:         'distributors',
          localField:   '_id.distributor',
          foreignField: '_id',
          as:           'distributorInfo'
        }
      },
      { $unwind: { path: '$distributorInfo', preserveNullAndEmptyArrays: true } },
      ...searchFilter,
      ...statusFilter,
      { $sort: { remaining: 1, lastDispatch: -1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: parseInt(limit) },
            {
              $project: {
                _id:              0,
                productId:        '$_id.product',
                distributorId:    '$_id.distributor',
                batchNumber:      '$_id.batchNumber',
                totalSent:        1,
                totalReturned:    1,
                remaining:        1,
                lastDispatch:     1,
                productName:      '$productInfo.name',
                productBrand:     '$productInfo.brand',
                productImage:     '$productInfo.image.url',
                genericName:      { $arrayElemAt: ['$productInfo.composition', 0] },
                manufacturingDate:'$productInfo.manufacturingDate',
                expiryDate:       '$productInfo.expiryDate',
                distributorName:  '$distributorInfo.name',
                distributorCode:  '$distributorInfo.businessName',
                distributorEmail: '$distributorInfo.email',
                status: statusExpr()
              }
            }
          ],
          total: [{ $count: 'count' }]
        }
      }
    ];

    const result = await DistributorDispatch.aggregate(pipeline);
    const items  = result[0]?.data  || [];
    const total  = result[0]?.total[0]?.count || 0;

    res.json({
      success: true,
      data: {
        items,
        total,
        page:  parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ────────────────────────────────────────────────────────────────────────────────
// GET /api/dist-inventory/product-detail
// Query: productId, distributorId, batchNumber
// ────────────────────────────────────────────────────────────────────────────────
exports.getProductDetail = async (req, res) => {
  try {
    const { productId, distributorId, batchNumber } = req.query;

    if (!productId || !distributorId || !batchNumber) {
      return res.status(400).json({
        success: false,
        message: 'productId, distributorId, and batchNumber are required'
      });
    }

    const upperBatch = batchNumber.toUpperCase();

    const [product, distributor, dispatches, returns] = await Promise.all([
      Product.findById(productId).select('name brand composition image manufacturingDate expiryDate'),
      Distributor.findById(distributorId).select('name businessName email phone'),
      DistributorDispatch.find({
        product:     productId,
        distributor: distributorId,
        batchNumber: upperBatch
      }).sort({ dispatchDate: -1 }),
      DistributorReturn.find({
        product:     productId,
        distributor: distributorId,
        batchNumber: upperBatch
      }).sort({ returnDate: -1 })
    ]);

    const totalSent     = dispatches.reduce((s, d) => s + d.quantitySent, 0);
    const totalReturned = returns
      .filter(r => r.returnStatus === 'Approved')
      .reduce((s, r) => s + r.quantityReturned, 0);

    res.json({
      success: true,
      data: {
        product: product ? {
          id:               product._id,
          name:             product.name,
          brand:            product.brand,
          genericName:      product.composition?.[0] || '—',
          image:            product.image?.url || null,
          manufacturingDate:product.manufacturingDate || '—',
          expiryDate:       product.expiryDate || '—'
        } : null,
        distributor: distributor ? {
          id:    distributor._id,
          name:  distributor.name,
          code:  distributor.businessName,
          email: distributor.email,
          phone: distributor.phone
        } : null,
        batchNumber: upperBatch,
        inventory: {
          totalSent,
          totalReturned,
          remaining: totalSent - totalReturned
        },
        dispatches: dispatches.map(d => ({
          id:            d._id,
          date:          d.dispatchDate,
          invoiceNumber: d.invoiceNumber,
          quantitySent:  d.quantitySent,
          batchNumber:   d.batchNumber,
          remarks:       d.remarks
        })),
        returns: returns.map(r => ({
          id:               r._id,
          date:             r.returnDate,
          quantityReturned: r.quantityReturned,
          reason:           r.returnReason,
          status:           r.returnStatus,
          remarks:          r.remarks
        }))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ────────────────────────────────────────────────────────────────────────────────
// GET /api/dist-inventory/dispatch
// ────────────────────────────────────────────────────────────────────────────────
exports.getDispatches = async (req, res) => {
  try {
    const {
      page = 1, limit = 20,
      distributorId, productId,
      invoiceNumber, search,
      dateFrom, dateTo
    } = req.query;

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const match = {};

    if (distributorId && mongoose.isValidObjectId(distributorId))
      match.distributor = new mongoose.Types.ObjectId(distributorId);
    if (productId && mongoose.isValidObjectId(productId))
      match.product = new mongoose.Types.ObjectId(productId);
    if (invoiceNumber)
      match.invoiceNumber = { $regex: invoiceNumber, $options: 'i' };
    if (dateFrom || dateTo) {
      match.dispatchDate = {};
      if (dateFrom) match.dispatchDate.$gte = new Date(dateFrom);
      if (dateTo)   match.dispatchDate.$lte = new Date(dateTo + 'T23:59:59');
    }

    const searchFilter = search
      ? [{
          $match: {
            $or: [
              { 'product.name':    { $regex: search, $options: 'i' } },
              { invoiceNumber:     { $regex: search, $options: 'i' } },
              { batchNumber:       { $regex: search, $options: 'i' } },
              { 'distributor.name':{ $regex: search, $options: 'i' } }
            ]
          }
        }]
      : [];

    const pipeline = [
      { $match: match },
      { $lookup: { from: 'products',      localField: 'product',     foreignField: '_id', as: 'product'     } },
      { $unwind: { path: '$product',      preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'distributors',  localField: 'distributor', foreignField: '_id', as: 'distributor' } },
      { $unwind: { path: '$distributor',  preserveNullAndEmptyArrays: true } },
      ...searchFilter,
      { $sort: { dispatchDate: -1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: parseInt(limit) },
            {
              $project: {
                _id:             1,
                invoiceNumber:   1,
                batchNumber:     1,
                quantitySent:    1,
                dispatchDate:    1,
                remarks:         1,
                productId:       '$product._id',
                productName:     '$product.name',
                productImage:    '$product.image.url',
                distributorId:   '$distributor._id',
                distributorName: '$distributor.name'
              }
            }
          ],
          total: [{ $count: 'count' }]
        }
      }
    ];

    const result = await DistributorDispatch.aggregate(pipeline);
    const items  = result[0]?.data  || [];
    const total  = result[0]?.total[0]?.count || 0;

    res.json({
      success: true,
      data: { items, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ────────────────────────────────────────────────────────────────────────────────
// POST /api/dist-inventory/dispatch
// ────────────────────────────────────────────────────────────────────────────────
exports.createDispatch = async (req, res) => {
  try {
    const { distributorId, productId, batchNumber, quantitySent, dispatchDate, invoiceNumber, remarks } = req.body;

    if (!distributorId || !productId || !batchNumber || !quantitySent || !invoiceNumber) {
      return res.status(400).json({
        success: false,
        message: 'distributorId, productId, batchNumber, quantitySent, and invoiceNumber are required'
      });
    }

    const [distributor, product] = await Promise.all([
      Distributor.findById(distributorId),
      Product.findById(productId)
    ]);
    if (!distributor) return res.status(404).json({ success: false, message: 'Distributor not found' });
    if (!product)     return res.status(404).json({ success: false, message: 'Product not found' });

    const dispatch = await DistributorDispatch.create({
      distributor:   distributorId,
      product:       productId,
      batchNumber:   batchNumber.toString().toUpperCase(),
      quantitySent:  parseInt(quantitySent),
      dispatchDate:  dispatchDate ? new Date(dispatchDate) : new Date(),
      invoiceNumber: invoiceNumber.toString().toUpperCase(),
      remarks:       remarks || ''
    });

    res.status(201).json({ success: true, message: 'Dispatch record created successfully', data: dispatch });
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ success: false, message: 'Invoice number already exists' });
    res.status(500).json({ success: false, message: err.message });
  }
};

// ────────────────────────────────────────────────────────────────────────────────
// GET /api/dist-inventory/returns
// ────────────────────────────────────────────────────────────────────────────────
exports.getReturns = async (req, res) => {
  try {
    const {
      page = 1, limit = 20,
      distributorId, productId,
      batchNumber, status, search,
      dateFrom, dateTo
    } = req.query;

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const match = {};

    if (distributorId && mongoose.isValidObjectId(distributorId))
      match.distributor = new mongoose.Types.ObjectId(distributorId);
    if (productId && mongoose.isValidObjectId(productId))
      match.product = new mongoose.Types.ObjectId(productId);
    if (batchNumber)
      match.batchNumber = { $regex: batchNumber, $options: 'i' };
    if (status)
      match.returnStatus = status;
    if (dateFrom || dateTo) {
      match.returnDate = {};
      if (dateFrom) match.returnDate.$gte = new Date(dateFrom);
      if (dateTo)   match.returnDate.$lte = new Date(dateTo + 'T23:59:59');
    }

    const searchFilter = search
      ? [{
          $match: {
            $or: [
              { 'product.name':    { $regex: search, $options: 'i' } },
              { batchNumber:       { $regex: search, $options: 'i' } },
              { 'distributor.name':{ $regex: search, $options: 'i' } }
            ]
          }
        }]
      : [];

    const pipeline = [
      { $match: match },
      { $lookup: { from: 'products',      localField: 'product',     foreignField: '_id', as: 'product'     } },
      { $unwind: { path: '$product',      preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'distributors',  localField: 'distributor', foreignField: '_id', as: 'distributor' } },
      { $unwind: { path: '$distributor',  preserveNullAndEmptyArrays: true } },
      ...searchFilter,
      { $sort: { returnDate: -1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: parseInt(limit) },
            {
              $project: {
                _id:              1,
                batchNumber:      1,
                quantityReturned: 1,
                returnReason:     1,
                returnDate:       1,
                returnStatus:     1,
                remarks:          1,
                productId:        '$product._id',
                productName:      '$product.name',
                productImage:     '$product.image.url',
                distributorId:    '$distributor._id',
                distributorName:  '$distributor.name'
              }
            }
          ],
          total: [{ $count: 'count' }]
        }
      }
    ];

    const result = await DistributorReturn.aggregate(pipeline);
    const items  = result[0]?.data  || [];
    const total  = result[0]?.total[0]?.count || 0;

    res.json({
      success: true,
      data: { items, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ────────────────────────────────────────────────────────────────────────────────
// POST /api/dist-inventory/returns
// ────────────────────────────────────────────────────────────────────────────────
exports.createReturn = async (req, res) => {
  try {
    const { distributorId, productId, batchNumber, quantityReturned, returnReason, returnDate, returnStatus, remarks } = req.body;

    if (!distributorId || !productId || !batchNumber || !quantityReturned || !returnReason) {
      return res.status(400).json({
        success: false,
        message: 'distributorId, productId, batchNumber, quantityReturned, and returnReason are required'
      });
    }

    const validReasons = ['Damaged', 'Expired', 'Near Expiry', 'Wrong Product', 'Leakage', 'Packaging Damage', 'Other'];
    if (!validReasons.includes(returnReason)) {
      return res.status(400).json({ success: false, message: 'Invalid return reason' });
    }

    const upperBatch = batchNumber.toString().toUpperCase();

    // Validate there is something dispatched for this combination
    const [dispatchAgg, returnAgg] = await Promise.all([
      DistributorDispatch.aggregate([
        { $match: { distributor: new mongoose.Types.ObjectId(distributorId), product: new mongoose.Types.ObjectId(productId), batchNumber: upperBatch } },
        { $group: { _id: null, totalSent: { $sum: '$quantitySent' } } }
      ]),
      DistributorReturn.aggregate([
        { $match: { distributor: new mongoose.Types.ObjectId(distributorId), product: new mongoose.Types.ObjectId(productId), batchNumber: upperBatch, returnStatus: 'Approved' } },
        { $group: { _id: null, totalReturned: { $sum: '$quantityReturned' } } }
      ])
    ]);

    const totalSent     = dispatchAgg[0]?.totalSent    || 0;
    const totalReturned = returnAgg[0]?.totalReturned  || 0;
    const remaining     = totalSent - totalReturned;

    if (totalSent === 0) {
      return res.status(400).json({ success: false, message: 'No dispatch records found for this product/distributor/batch combination' });
    }
    if (parseInt(quantityReturned) > remaining) {
      return res.status(400).json({
        success: false,
        message: `Return quantity (${quantityReturned}) exceeds remaining stock (${remaining})`
      });
    }

    const returnRecord = await DistributorReturn.create({
      distributor:      distributorId,
      product:          productId,
      batchNumber:      upperBatch,
      quantityReturned: parseInt(quantityReturned),
      returnReason,
      returnDate:       returnDate ? new Date(returnDate) : new Date(),
      returnStatus:     returnStatus || 'Pending',
      remarks:          remarks || ''
    });

    res.status(201).json({ success: true, message: 'Return record created successfully', data: returnRecord });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ────────────────────────────────────────────────────────────────────────────────
// PUT /api/dist-inventory/returns/:id
// ────────────────────────────────────────────────────────────────────────────────
exports.updateReturnStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { returnStatus, remarks } = req.body;

    if (!['Pending', 'Approved', 'Rejected'].includes(returnStatus)) {
      return res.status(400).json({ success: false, message: 'returnStatus must be Pending, Approved, or Rejected' });
    }

    const update = { returnStatus };
    if (remarks !== undefined) update.remarks = remarks;

    const returnRecord = await DistributorReturn.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!returnRecord) return res.status(404).json({ success: false, message: 'Return record not found' });

    res.json({ success: true, message: 'Return status updated', data: returnRecord });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ────────────────────────────────────────────────────────────────────────────────
// GET /api/dist-inventory/notifications
// ────────────────────────────────────────────────────────────────────────────────
exports.getNotifications = async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const notifications = [];

    // 1. Newly dispatched (last 7 days)
    const recentDispatches = await DistributorDispatch.find({ dispatchDate: { $gte: sevenDaysAgo } })
      .populate('product',     'name')
      .populate('distributor', 'name')
      .sort({ dispatchDate: -1 })
      .limit(5);

    for (const d of recentDispatches) {
      notifications.push({
        type:     'dispatch',
        severity: 'info',
        message:  `${d.quantitySent} units of "${d.product?.name || 'Unknown Product'}" dispatched to ${d.distributor?.name || 'Unknown'}`,
        date:     d.dispatchDate
      });
    }

    // 2. Large returns (qty ≥ 100)
    const largeReturns = await DistributorReturn.find({ quantityReturned: { $gte: 100 } })
      .populate('product',     'name')
      .populate('distributor', 'name')
      .sort({ returnDate: -1 })
      .limit(5);

    for (const r of largeReturns) {
      notifications.push({
        type:     'large-return',
        severity: 'warning',
        message:  `Large return: ${r.quantityReturned} units of "${r.product?.name || 'Unknown'}" from ${r.distributor?.name || 'Unknown'} — ${r.returnReason}`,
        date:     r.returnDate
      });
    }

    // 3. Fully-depleted inventory (remaining ≤ 0)
    const emptyInv = await DistributorDispatch.aggregate([
      { $group: { _id: { distributor: '$distributor', product: '$product', batchNumber: '$batchNumber' }, totalSent: { $sum: '$quantitySent' } } },
      returnLookupStage(),
      calcRemainingStage(),
      { $match: { remaining: { $lte: 0 } } },
      { $lookup: { from: 'products',      localField: '_id.product',     foreignField: '_id', as: 'product'     } },
      { $lookup: { from: 'distributors',  localField: '_id.distributor', foreignField: '_id', as: 'distributor' } },
      { $unwind: { path: '$product',      preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$distributor',  preserveNullAndEmptyArrays: true } },
      { $limit: 5 },
      { $project: { productName: '$product.name', distributorName: '$distributor.name', batchNumber: '$_id.batchNumber' } }
    ]);

    for (const inv of emptyInv) {
      notifications.push({
        type:     'no-stock',
        severity: 'danger',
        message:  `"${inv.productName || 'Unknown'}" (Batch: ${inv.batchNumber}) fully returned by ${inv.distributorName || 'Unknown'} — no stock remaining`,
        date:     new Date()
      });
    }

    // 4. Low stock (remaining 1–50)
    const lowStock = await DistributorDispatch.aggregate([
      { $group: { _id: { distributor: '$distributor', product: '$product', batchNumber: '$batchNumber' }, totalSent: { $sum: '$quantitySent' } } },
      returnLookupStage(),
      calcRemainingStage(),
      { $match: { remaining: { $gt: 0, $lte: 50 } } },
      { $lookup: { from: 'products',     localField: '_id.product',     foreignField: '_id', as: 'product'     } },
      { $lookup: { from: 'distributors', localField: '_id.distributor', foreignField: '_id', as: 'distributor' } },
      { $unwind: { path: '$product',     preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$distributor', preserveNullAndEmptyArrays: true } },
      { $limit: 5 },
      { $project: { productName: '$product.name', distributorName: '$distributor.name', batchNumber: '$_id.batchNumber', remaining: 1 } }
    ]);

    for (const inv of lowStock) {
      notifications.push({
        type:     'low-stock',
        severity: 'warning',
        message:  `Low stock: ${inv.remaining} units of "${inv.productName || 'Unknown'}" (Batch: ${inv.batchNumber}) with ${inv.distributorName || 'Unknown'}`,
        date:     new Date()
      });
    }

    const severityOrder = { danger: 0, warning: 1, info: 2 };
    notifications.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    res.json({ success: true, data: notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ────────────────────────────────────────────────────────────────────────────────
// GET /api/dist-inventory/distributors  (for dropdowns)
// ────────────────────────────────────────────────────────────────────────────────
exports.getDistributors = async (req, res) => {
  try {
    const distributors = await Distributor.find({ status: 'active' })
      .select('name businessName')
      .sort({ name: 1 });
    res.json({ success: true, data: distributors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ────────────────────────────────────────────────────────────────────────────────
// GET /api/dist-inventory/products  (for dropdowns)
// ────────────────────────────────────────────────────────────────────────────────
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find({ status: 'active' })
      .select('name brand image')
      .sort({ name: 1 });
    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
