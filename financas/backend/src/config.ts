import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4100),
  nodeEnv: process.env.NODE_ENV ?? "development",
  jwt: {
    secret: process.env.JWT_SECRET ?? "dev-secret-change-me",
    expiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  },
  cors: {
    origin: (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(","),
  },
  seedPassword: process.env.SEED_PASSWORD ?? "familia123",
};
