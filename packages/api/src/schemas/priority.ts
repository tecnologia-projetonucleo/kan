import { z } from "zod";

// Mirrors cardPriorities in @kan/db/schema. Kept local so the API does not
// load the whole schema module at runtime.
export const cardPrioritySchema = z.enum(["high", "normal", "low"]);
