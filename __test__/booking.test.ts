import { Types } from 'mongoose';
import { createBooking, cancelBooking } from '../controllers/bookingController';
import Booking from '../models/Booking';
import Service from '../models/Service';


const mockRes = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

const newIds = () => ({
  salonId: new Types.ObjectId().toString(),
  stylistId: new Types.ObjectId().toString(),
  serviceId: new Types.ObjectId().toString(),
});


describe('POST /api/bookings', () => {
  it('returns 400 when the date field is missing from the request body', async () => {
    const req = { body: { ...newIds() }, user: { _id: new Types.ObjectId() } };
    const res = mockRes();

    await createBooking(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'date is required' });
  });

  it('returns 404 when the requested service does not exist', async () => {
    jest.spyOn(Service, 'findById').mockResolvedValue(null);
    const req = {
      body: { ...newIds(), date: '2026-11-01', slotTime: '09:00' },
      user: { _id: new Types.ObjectId() },
    };
    const res = mockRes();

    await createBooking(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Service not found' });
  });

  it('returns 400 when the chosen slot overlaps with an existing booking for that stylist', async () => {
    jest.spyOn(Service, 'findById').mockResolvedValue({ duration: 60 } as any);
    // Existing booking: 10:00 – 11:00. New request: 10:30 – 11:30 → overlaps.
    jest.spyOn(Booking, 'find').mockResolvedValue([
      { startTime: '10:00', endTime: '11:00' },
    ] as any);
    const req = {
      body: { ...newIds(), date: '2026-11-01', slotTime: '10:30' },
      user: { _id: new Types.ObjectId() },
    };
    const res = mockRes();

    await createBooking(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Time slot is no longer available' });
  });

  it('allows a slot that starts exactly when another booking ends (no overlap)', async () => {
    jest.spyOn(Service, 'findById').mockResolvedValue({ duration: 30 } as any);
    // Existing booking: 09:00 – 10:00. New request: 10:00 – 10:30 → back-to-back, not overlapping.
    jest.spyOn(Booking, 'find').mockResolvedValue([
      { startTime: '09:00', endTime: '10:00' },
    ] as any);
    jest.spyOn(Booking.prototype, 'save').mockResolvedValue({} as any);
    const req = {
      body: { ...newIds(), date: '2026-11-01', slotTime: '10:00' },
      user: { _id: new Types.ObjectId() },
    };
    const res = mockRes();

    await createBooking(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('creates the booking and correctly calculates the end time', async () => {
    jest.spyOn(Service, 'findById').mockResolvedValue({ duration: 45 } as any);
    jest.spyOn(Booking, 'find').mockResolvedValue([] as any);
    jest.spyOn(Booking.prototype, 'save').mockResolvedValue({} as any);
    const req = {
      body: { ...newIds(), date: '2026-11-01', slotTime: '10:30' },
      user: { _id: new Types.ObjectId() },
    };
    const res = mockRes();

    await createBooking(req as any, res as any);

    // 10:30 + 45 min = 11:15
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Booking created successfully',
        booking: expect.objectContaining({ endTime: '11:15' }),
      })
    );
  });

  it('calculates end time correctly when it crosses the hour boundary (e.g. 09:50 + 30 min = 10:20)', async () => {
    jest.spyOn(Service, 'findById').mockResolvedValue({ duration: 30 } as any);
    jest.spyOn(Booking, 'find').mockResolvedValue([] as any);
    jest.spyOn(Booking.prototype, 'save').mockResolvedValue({} as any);
    const req = {
      body: { ...newIds(), date: '2026-11-01', slotTime: '09:50' },
      user: { _id: new Types.ObjectId() },
    };
    const res = mockRes();

    await createBooking(req as any, res as any);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        booking: expect.objectContaining({ endTime: '10:20' }),
      })
    );
  });

  it('returns 500 when an unexpected server error occurs during booking creation', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(Service, 'findById').mockRejectedValue(new Error('DB error'));
    const req = {
      body: { ...newIds(), date: '2026-11-01', slotTime: '09:00' },
      user: { _id: new Types.ObjectId() },
    };
    const res = mockRes();

    await createBooking(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
  });
});


describe('POST /api/bookings/:bookingId/cancel', () => {
  const customerId = new Types.ObjectId();
  const bookingId = new Types.ObjectId().toString();

  it('returns 404 when the booking ID does not exist', async () => {
    jest.spyOn(Booking, 'findById').mockResolvedValue(null);
    const req = { params: { bookingId }, user: { _id: customerId, role: 'customer' } };
    const res = mockRes();

    await cancelBooking(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Booking not found' });
  });

  it('returns 403 when a different customer tries to cancel someone else\'s booking', async () => {
    jest.spyOn(Booking, 'findById').mockResolvedValue({
      customerId: new Types.ObjectId(), // different owner
      status: 'booked',
    } as any);
    const req = { params: { bookingId }, user: { _id: customerId, role: 'customer' } };
    const res = mockRes();

    await cancelBooking(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authorized to cancel this booking' });
  });

  it('allows an admin to cancel any booking regardless of ownership', async () => {
    const booking = {
      customerId: new Types.ObjectId(), // different owner than the admin
      status: 'booked',
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(Booking, 'findById').mockResolvedValue(booking as any);
    const req = {
      params: { bookingId },
      user: { _id: new Types.ObjectId(), role: 'admin' },
    };
    const res = mockRes();

    await cancelBooking(req as any, res as any);

    expect(booking.status).toBe('cancelled');
    expect(res.json).toHaveBeenCalledWith({ message: 'Booking cancelled successfully' });
  });

  it('returns 400 when the booking is already in a cancelled state', async () => {
    jest.spyOn(Booking, 'findById').mockResolvedValue({
      customerId,
      status: 'cancelled',
    } as any);
    const req = { params: { bookingId }, user: { _id: customerId, role: 'customer' } };
    const res = mockRes();

    await cancelBooking(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Booking is already cancelled' });
  });

  it('successfully cancels the booking and persists the change', async () => {
    const booking = {
      customerId,
      status: 'booked',
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(Booking, 'findById').mockResolvedValue(booking as any);
    const req = { params: { bookingId }, user: { _id: customerId, role: 'customer' } };
    const res = mockRes();

    await cancelBooking(req as any, res as any);

    expect(booking.status).toBe('cancelled');
    expect(booking.save).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ message: 'Booking cancelled successfully' });
  });

  it('returns 500 when an unexpected error is thrown while cancelling', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(Booking, 'findById').mockRejectedValue(new Error('DB timeout'));
    const req = { params: { bookingId }, user: { _id: customerId, role: 'customer' } };
    const res = mockRes();

    await cancelBooking(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
  });
});
