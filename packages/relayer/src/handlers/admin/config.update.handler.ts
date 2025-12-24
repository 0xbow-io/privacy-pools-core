import { NextFunction, Response } from "express";
import { ConfigChangeMarshall } from "../../types.js";
import { UpdateConfigRequest } from "../../middlewares/admin/config.middleware.js";
import { RelayerConfig } from "../../config/index.js";

/**
 * Handler for the relayer config endpoint.
 * Returns Ok if config was updated.
 * 
 * @param {Request} req - The HTTP request.
 * @param {Response} res - The HTTP response.
 * @param {NextFunction} next - The next middleware function.
 */
export async function configUpdateHandler(
  req: UpdateConfigRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const body = req.body;

    console.debug(`call to /config with:`, body);

    const config = new RelayerConfig();
    const newConfig = await config.updateConfig(body);

    // Return details for the specific asset
    res.status(200).json(
      res.locals.marshalResponse(
        new ConfigChangeMarshall(newConfig)
      )
    );

    next();
  } catch (error) {
    next(error);
  }
}

