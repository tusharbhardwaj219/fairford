const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fail = (res, msg) =>
  res.status(400).json({ success: false, message: msg });

const validateSignup = (req, res, next) => {
  const { name, email, password } = req.body;
  if (!name  || name.trim().length < 2)    return fail(res, 'Name must be at least 2 characters');
  if (!email || !EMAIL_RE.test(email))     return fail(res, 'A valid email is required');
  if (!password || password.length < 6)   return fail(res, 'Password must be at least 6 characters');
  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !EMAIL_RE.test(email)) return fail(res, 'A valid email is required');
  if (!password)                        return fail(res, 'Password is required');
  next();
};

module.exports = { validateSignup, validateLogin };
