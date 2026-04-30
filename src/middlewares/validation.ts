import ResponseError from '@/utils/response-error.js';

import type { Request, Response, NextFunction } from 'express';

type FieldType = 'string' | 'boolean';
type Field = { name: string; type: FieldType; optional?: boolean };
type CheckValidation = (data: Record<string, unknown>) => void;

/**
 * Middleware validasi dinamis untuk memvalidasi field di request body.
 * Mengecek keberadaan field, tipe data, lalu menjalankan fungsi validasi spesifik.
 *
 * @param {Field[]} fields - Daftar field yang dibutuhkan beserta tipe datanya
 * @param {CheckValidation} checkValidation - Fungsi validasi spesifik per endpoint
 * @returns {(req: Request, _res: Response, next: NextFunction) => void} Express middleware function
 */
export default function validation(
  fields: Field[],
  checkValidation: CheckValidation,
): (req: Request, _res: Response, next: NextFunction) => void {
  return function (req: Request, _res: Response, next: NextFunction) {
    try {
      for (const field of fields) {
        const value = req.body[field.name];

        if (field.optional && (value === undefined || value === null)) continue;

        if (value === undefined || value === null) {
          throw new ResponseError(
            400,
            'Invalid Data',
            `Field ${field.name} is required but was not provided.`,
          );
        }

        if (typeof value !== field.type) {
          throw new ResponseError(
            400,
            'Invalid Data Type',
            `Field ${field.name} must be a ${field.type}.`,
          );
        }
      }

      checkValidation(req.body);

      next();
    } catch (err) {
      next(err);
    }
  };
}
