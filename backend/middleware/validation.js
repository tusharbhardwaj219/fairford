/**
 * Email validation regex
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Password must contain:
 * - At least 12 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one number (0-9)
 * - At least one special character (@$!%*?&)
 */
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

const fail = (res, msg) => res.status(400).json({ success: false, message: msg });

/**
 * Validate signup request
 * Checks: name, email, password strength, confirmPassword match, and role
 */
const validateSignup = (req, res, next) => {
  const { name, email, password, confirmPassword, role } = req.body;

  // Validate name
  if (!name || name.trim().length < 2) {
    return fail(res, 'Name must be at least 2 characters');
  }

  // Validate email
  if (!email || !EMAIL_RE.test(email)) {
    return fail(res, 'A valid email address is required');
  }

  // Validate password is provided
  if (!password) {
    return fail(res, 'Password is required');
  }

  // Validate password length (minimum 12 characters)
  if (password.length < 12) {
    return fail(res, 'Password must be at least 12 characters long');
  }

  // Validate password strength (uppercase, lowercase, number, special char)
  if (!PASSWORD_RE.test(password)) {
    return fail(res,
      'Password must contain at least one uppercase letter, one lowercase letter, ' +
      'one number, and one special character (@$!%*?&)'
    );
  }

  // Validate password confirmation is provided
  if (!confirmPassword) {
    return fail(res, 'Password confirmation is required');
  }

  // Validate passwords match
  if (password !== confirmPassword) {
    return fail(res, 'Passwords do not match');
  }

  // Only retailers can self-register; distributors are admin-onboarded
  if (role !== 'ret') {
    return fail(res, 'Self sign-up is available for Retailer / Chemist accounts only. Contact admin to onboard other account types.');
  }

  next();
};

/**
 * Validate login request
 * Checks: email format and password is provided
 */
const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !EMAIL_RE.test(email)) {
    return fail(res, 'A valid email address is required');
  }

  if (!password) {
    return fail(res, 'Password is required');
  }

  next();
};

module.exports = { validateSignup, validateLogin };
