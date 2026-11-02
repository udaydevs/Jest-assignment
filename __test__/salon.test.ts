import { Types } from 'mongoose';
import { getAvailableSlots } from '../controllers/salonController';
import Salon from '../models/Salon';
import Service from '../models/Service';
import Booking from '../models/Booking';
import User from '../models/User';

const mockRes = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

const newIds = () => ({
  salonId: new Types.ObjectId().toString(),
  serviceId: new Types.ObjectId().toString(),
});

describe('GET /api/salons/:salonId/available-slots', () => {
  it('returns 400 when both date and serviceId are missing', async () => {
    const res = mockRes();

    await getAvailableSlots({ params: {}, query: {} } as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'date and serviceId are required' });
  });

  it('returns 400 when only the date is provided (serviceId missing)', async () => {
    const res = mockRes();

    await getAvailableSlots(
      { params: { salonId: 'any' }, query: { date: '2026-11-01' } } as any,
      res as any
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'date and serviceId are required' });
  });

  it('returns 400 when only serviceId is provided (date missing)', async () => {
    const res = mockRes();

    await getAvailableSlots(
      { params: { salonId: 'any' }, query: { serviceId: 'some-id' } } as any,
      res as any
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'date and serviceId are required' });
  });

  it('returns 404 when the salon does not exist', async () => {
    const { salonId, serviceId } = newIds();
    jest.spyOn(Salon, 'findById').mockResolvedValue(null);
    jest.spyOn(Service, 'findById').mockResolvedValue({ name: 'Cut', duration: 30 } as any);
    const res = mockRes();

    await getAvailableSlots(
      { params: { salonId }, query: { date: '2026-11-01', serviceId } } as any,
      res as any
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Salon or Service not found' });
  });

  it('returns 404 when the service does not exist', async () => {
    const { salonId, serviceId } = newIds();
    jest.spyOn(Salon, 'findById').mockResolvedValue({ openTime: '09:00', closeTime: '18:00' } as any);
    jest.spyOn(Service, 'findById').mockResolvedValue(null);
    const res = mockRes();

    await getAvailableSlots(
      { params: { salonId }, query: { date: '2026-11-01', serviceId } } as any,
      res as any
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Salon or Service not found' });
  });

  it('returns an empty slot list when the service duration fills the entire salon window', async () => {
    const { salonId, serviceId } = newIds();
    jest.spyOn(Salon, 'findById').mockResolvedValue({ openTime: '09:00', closeTime: '10:00' } as any);
    jest.spyOn(Service, 'findById').mockResolvedValue({ name: 'Long Treatment', duration: 90 } as any);
    jest.spyOn(User, 'find').mockResolvedValue([{ _id: new Types.ObjectId(), name: 'Stylist A' }] as any);
    jest.spyOn(Booking, 'find').mockResolvedValue([] as any);
    const res = mockRes();

    await getAvailableSlots(
      { params: { salonId }, query: { date: '2026-11-01', serviceId } } as any,
      res as any
    );

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ availableSlots: [] })
    );
  });

  it('excludes a stylist whose schedule conflicts but keeps other available stylists', async () => {
    const busyStylistId = new Types.ObjectId();
    const freeStylistId = new Types.ObjectId();
    const { salonId, serviceId } = newIds();

    // Salon: 09:00 – 10:30, service: 60 min → slots at 09:00 and 09:30
    jest.spyOn(Salon, 'findById').mockResolvedValue({ openTime: '09:00', closeTime: '10:30' } as any);
    jest.spyOn(Service, 'findById').mockResolvedValue({ name: 'Cut', duration: 60 } as any);
    jest.spyOn(User, 'find').mockResolvedValue([
      { _id: busyStylistId, name: 'Busy Barber' },
      { _id: freeStylistId, name: 'Free Barber' },
    ] as any);
    jest.spyOn(Booking, 'find').mockResolvedValue([
      { stylistId: busyStylistId, startTime: '09:30', endTime: '10:00' },
    ] as any);
    const res = mockRes();

    await getAvailableSlots(
      { params: { salonId }, query: { date: '2026-11-01', serviceId } } as any,
      res as any
    );

    const { availableSlots } = (res.json as jest.Mock).mock.calls[0][0];

    expect(availableSlots.some((s: any) => s.stylistId.toString() === busyStylistId.toString())).toBe(false);
    expect(availableSlots.filter((s: any) => s.stylistId.toString() === freeStylistId.toString())).toHaveLength(2);
  });

  it('returns all stylists in every slot when there are no existing bookings', async () => {
    const stylistA = new Types.ObjectId();
    const stylistB = new Types.ObjectId();
    const { salonId, serviceId } = newIds();

    jest.spyOn(Salon, 'findById').mockResolvedValue({ openTime: '09:00', closeTime: '09:30' } as any);
    jest.spyOn(Service, 'findById').mockResolvedValue({ name: 'Quick Trim', duration: 30 } as any);
    jest.spyOn(User, 'find').mockResolvedValue([
      { _id: stylistA, name: 'Alice' },
      { _id: stylistB, name: 'Bob' },
    ] as any);
    jest.spyOn(Booking, 'find').mockResolvedValue([] as any);
    const res = mockRes();

    await getAvailableSlots(
      { params: { salonId }, query: { date: '2026-11-01', serviceId } } as any,
      res as any
    );

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        availableSlots: expect.arrayContaining([
          expect.objectContaining({ time: '09:00', stylistId: stylistA, stylistName: 'Alice' }),
          expect.objectContaining({ time: '09:00', stylistId: stylistB, stylistName: 'Bob' }),
        ]),
      })
    );
  });

  it('includes the service name and duration in the response payload', async () => {
    const { salonId, serviceId } = newIds();
    jest.spyOn(Salon, 'findById').mockResolvedValue({ openTime: '09:00', closeTime: '09:30' } as any);
    jest.spyOn(Service, 'findById').mockResolvedValue({ name: 'Beard Trim', duration: 30 } as any);
    jest.spyOn(User, 'find').mockResolvedValue([{ _id: new Types.ObjectId(), name: 'Stylist X' }] as any);
    jest.spyOn(Booking, 'find').mockResolvedValue([] as any);
    const res = mockRes();

    await getAvailableSlots(
      { params: { salonId }, query: { date: '2026-11-01', serviceId } } as any,
      res as any
    );

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        date: '2026-11-01',
        service: 'Beard Trim',
        duration: 30,
      })
    );
  });

  it('returns 500 when a database query throws an unexpected error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { salonId, serviceId } = newIds();
    jest.spyOn(Salon, 'findById').mockRejectedValue(new Error('Connection refused'));
    const res = mockRes();

    await getAvailableSlots(
      { params: { salonId }, query: { date: '2026-11-01', serviceId } } as any,
      res as any
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server error' });
  });
});
