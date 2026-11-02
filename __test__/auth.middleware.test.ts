import jwt from 'jsonwebtoken';
import { authMiddleware } from '../middleware/auth';
import User from '../models/User';


const mockRes = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};


describe('Authentication middleware', () => {
  it('returns 401 when no Authorization header is sent', async () => {
    const req = { header: jest.fn().mockReturnValue(undefined) };
    const res = mockRes();
    const next = jest.fn();

    await authMiddleware(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the Authorization header has an empty bearer value', async () => {
    const req = { header: jest.fn().mockReturnValue('Bearer ') };
    const res = mockRes();
    const next = jest.fn();

    await authMiddleware(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 and "Invalid token" when jwt.verify throws', async () => {
    jest.spyOn(jwt, 'verify').mockImplementation(() => {
      throw new Error('jwt malformed');
    });
    const req = { header: jest.fn().mockReturnValue('Bearer bad.token.here') };
    const res = mockRes();
    const next = jest.fn();

    await authMiddleware(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the token is valid but the user no longer exists in the DB', async () => {
    jest.spyOn(jwt, 'verify').mockReturnValue({ userId: 'deleted-user-id', role: 'customer' } as any);
    jest.spyOn(User, 'findById').mockResolvedValue(null);
    const req = { header: jest.fn().mockReturnValue('Bearer valid.but.stale') };
    const res = mockRes();
    const next = jest.fn();

    await authMiddleware(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches the user to req and calls next() when the token is fully valid', async () => {
    const fakeUser = { _id: 'user-123', role: 'customer' };
    jest.spyOn(jwt, 'verify').mockReturnValue({ userId: 'user-123', role: 'customer' } as any);
    jest.spyOn(User, 'findById').mockResolvedValue(fakeUser as any);
    const req: any = { header: jest.fn().mockReturnValue('Bearer good.token') };
    const res = mockRes();
    const next = jest.fn();

    await authMiddleware(req, res as any, next);

    expect(req.user).toEqual(fakeUser);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('passes the correct JWT_SECRET to jwt.verify', async () => {
    const verifySpy = jest.spyOn(jwt, 'verify').mockReturnValue({ userId: 'u1', role: 'admin' } as any);
    jest.spyOn(User, 'findById').mockResolvedValue({ _id: 'u1', role: 'admin' } as any);
    const req: any = { header: jest.fn().mockReturnValue('Bearer some.token') };
    const res = mockRes();
    const next = jest.fn();

    await authMiddleware(req, res as any, next);

    expect(verifySpy).toHaveBeenCalledWith(
      'some.token',
      expect.any(String)
    );
  });
});
