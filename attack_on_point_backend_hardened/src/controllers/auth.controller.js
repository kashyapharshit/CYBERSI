const {
  registerUserService,
  loginUserService,
  getUserByIdService,
} = require('../services/auth.service');
const logger = require('../utils/logger');

// POST /auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    const result = await registerUserService({ name, email, password, role });
    logger.info(`New user registered: ${email}`);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

// POST /auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const result = await loginUserService({ email, password });
    logger.info(`User logged in: ${email}`);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// GET /auth/me  (protected route, req.user JWT middleware se aata hai)
const getMe = async (req, res, next) => {
  try {
    const user = await getUserByIdService(req.user.id);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe };