import env from './env';

export const allowedOrigins = env.isProd ? [env.clientUrl] : [env.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'];

// Any loopback or private-network (LAN) origin on any port, in every environment.
// Lets the admin panel be reached from other devices on the local network
// (e.g. a phone opening http://192.168.x.x:5173 or http://10.x.x.x:5000) while
// still rejecting public-internet origins.
const privateNetworkPattern =
  /^https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3})(?::\d+)?$/;

export const corsOptions = {
  origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    if (!origin) {
      callback(null, true);
      return;
    }
    const allowed = allowedOrigins.includes(origin) || privateNetworkPattern.test(origin);
    if (allowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};