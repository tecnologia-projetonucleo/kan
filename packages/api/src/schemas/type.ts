import { z } from "zod";

// Mirrors cardTypes in @kan/db/schema. Kept local so the API does not
// load the whole schema module at runtime.
export const cardTypeSchema = z.enum(["bug", "improvement"]);
