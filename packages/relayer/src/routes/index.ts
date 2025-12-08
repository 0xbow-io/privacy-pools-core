import { Router } from "express";
import {
  relayerDetailsHandler,
  relayQuoteHandler,
  relayRequestHandler,
} from "../handlers/index.js";
import {
    DetailsRequest,
  validateDetailsMiddleware,
  validateQuoteMiddleware,
  validateRelayRequestMiddleware
} from "../middlewares/relayer/request.js";
import { validateConfigDeleteMiddleware, validateConfigUpdateMiddleware } from "../middlewares/admin/config.middleware.js";
import { configUpdateHandler } from "../handlers/admin/config.update.handler.js";
import { configDeleteHandler } from "../handlers/admin/config.delete.handler.js";

// Router setup
export const relayerRouter = (): Router => {
  const router = Router();

  router.get("/details",
    validateDetailsMiddleware,
    (req, res, next) => relayerDetailsHandler(req as DetailsRequest, res, next)
  );

  router.post("/request", 
    validateRelayRequestMiddleware,
    relayRequestHandler
  );

  router.post("/quote", 
    validateQuoteMiddleware,
    relayQuoteHandler
  );
  return router;
}

export const adminRouter = (): Router => {
  const router = Router();

  router.patch("/config",
    validateConfigUpdateMiddleware,
    configUpdateHandler
  );

  router.delete("/config", 
    validateConfigDeleteMiddleware,
    configDeleteHandler
  );
  return router;
};
