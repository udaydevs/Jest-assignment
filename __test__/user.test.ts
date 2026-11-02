import bcrypt from 'bcryptjs';
import { login, register } from '../controllers/authController';
import User from '../models/User';


const mockRes = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

const validBody = {
  name: 'Uday Singh',
  email: 'uday@example.com',
  password: 'mypassword',
};


describe('POST /api/register', () => {
  it('rejects a registration when the email is already taken', async () => {
    jest.spyOn(User, 'findOne').mockResolvedValue({ _id: 'existing-user' } as any);
    const res = mockRes();

    await register({ body: validBody } as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Email already in use' });
  });

  it('hashes the password before saving', async () => {
    jest.spyOn(User, 'findOne').mockResolvedValue(null);
    const hashSpy = jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed_pw' as never);
    jest.spyOn(User.prototype, 'save').mockResolvedValue({} as any);
    const res = mockRes();

    await register({ body: validBody } as any, res as any);

    expect(hashSpy).toHaveBeenCalledWith('mypassword', 10);
  });

  it('saves the new user with role set to customer', async () => {
    jest.spyOn(User, 'findOne').mockResolvedValue(null);
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed_pw' as never);
    const saveSpy = jest.spyOn(User.prototype, 'save').mockResolvedValue({} as any);
    const res = mockRes();

    await register({ body: validBody } as any, res as any);

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: 'User registered successfully' });
  });

  it('responds with 500 when saving throws an unexpected error', async () => {
    jest.spyOn(User, 'findOne').mockResolvedValue(null);
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed_pw' as never);
    jest.spyOn(User.prototype, 'save').mockRejectedValue(new Error('DB down'));
    const res = mockRes();

    await register({ body: validBody } as any, res as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
  });
});


describe('POST /api/login', () => {
  const cred = { email: validBody.email, password: validBody.password };

  it('returns 400 when no user exists with that email', async () => {
    jest.spyOn(User, 'findOne').mockResolvedValue(null);
    const res = mockRes();

    await login({ body: cred } as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid cred' });
  });

  it('returns 400 when the password does not match', async () => {
    jest.spyOn(User, 'findOne').mockResolvedValue({ password: 'some_hash' } as any);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);
    const res = mockRes();

    await login({ body: cred } as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid cred' });
  });

  it('returns a JWT token, role, and userId on successful login', async () => {
    jest.spyOn(User, 'findOne').mockResolvedValue({
      _id: 'abc123',
      password: 'some_hash',
      role: 'customer',
    } as any);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    const res = mockRes();

    await login({ body: cred } as any, res as any);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        token: expect.any(String),
        role: 'customer',
        userId: 'abc123',
      })
    );
  });

  it('responds with 500 when an unexpected database error occurs', async () => {
    jest.spyOn(User, 'findOne').mockRejectedValue(new Error('Connection lost'));
    const res = mockRes();

    await login({ body: cred } as any, res as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
  });
});
