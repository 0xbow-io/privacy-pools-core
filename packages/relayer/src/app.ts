import bodyParser from "body-parser";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import {
  errorHandlerMiddleware,
  marshalResponseMiddleware,
  notFoundMiddleware,
} from "./middlewares/index.js";
import { relayerRouter } from "./routes/index.js";
import { CONFIG } from "./config/index.js";

// Initialize the express app
const app = express();

// Middleware functions
const parseJsonMiddleware = bodyParser.json();

// CORS config
const corsOptions = {
  origin: CONFIG.cors_allow_all ? '*' : function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    if (!origin || CONFIG.allowed_domains.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`Request blocked by CORS middleware: ${origin}. Allowed domains: ${CONFIG.allowed_domains}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
};


// Apply middleware and routes
app.use(cors(corsOptions));
app.use(parseJsonMiddleware);
app.use(marshalResponseMiddleware);

// ping route
app.use("/ping", (req: Request, res: Response, next: NextFunction) => {
  res.send("pong");
  next();
});

// relayer route
app.use("/relayer", relayerRouter);

// Error and 404 handling
app.use([errorHandlerMiddleware, notFoundMiddleware]);

export { app };
