import { z } from "zod";

export const RTU_DOMAIN = "rtu.edu.ph";

export const isRtuEmail = (email: string) =>
  new RegExp(`^[^\\s@]+@${RTU_DOMAIN.replaceAll(".", "\\.")}$`, "i").test(email.trim());

/** Matches the Supabase Auth setting: 8+ characters with lowercase, uppercase, a number and a symbol. */
export const PASSWORD_RULE = "Use at least 8 characters, with an uppercase letter, a lowercase letter, a number and a symbol.";
const strongPassword = z
  .string()
  .min(8, PASSWORD_RULE)
  .refine((p) => /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p), PASSWORD_RULE);

// Contact details are blocked in reports and claim messages (Terms of Use, "Messaging").
// Patterns are deliberately narrow so dates (2026-09-22) and room numbers don't trip them.
const PH_MOBILE = /(?:\+?63|\b0)9\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b/;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const SOCIAL = /\b(?:facebook\.com|fb\.com|m\.me|instagram\.com|t\.me|tiktok\.com|x\.com)\/\S+/i;
const HANDLE = /(?:^|\s)@[A-Za-z0-9_.]{3,}/;
// RTU student numbers (e.g. 2024-200544) and long digit runs that look like ID or card numbers.
const STUDENT_NO = /\b(?:19|20)\d{2}-\d{5,6}\b/;
const LONG_ID = /\b\d{9,}\b/;

export type BlockReason = "phone" | "email" | "social" | "id_number";

export function findBlockedDetail(text: string): BlockReason | null {
  if (PH_MOBILE.test(text)) return "phone";
  if (EMAIL.test(text)) return "email";
  if (SOCIAL.test(text) || HANDLE.test(text)) return "social";
  if (STUDENT_NO.test(text) || LONG_ID.test(text)) return "id_number";
  return null;
}

export const blockMessage: Record<BlockReason, string> = {
  phone: "Remove the phone number. Contact details can't be shared here.",
  email: "Remove the email address. Contact details can't be shared here.",
  social: "Remove the social media link or handle. Contact details can't be shared here.",
  id_number: "Remove the ID or student number. BalikGamit doesn't store ID numbers.",
};

const noContactDetails = (s: string) => findBlockedDetail(s) === null;

export const signInSchema = z.object({
  email: z.string().trim().refine(isRtuEmail, "Please sign up with your RTU email address (@rtu.edu.ph)."),
  password: z.string().min(1, "Enter your password."),
});

export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name."),
    email: z.string().trim().refine(isRtuEmail, "Please sign up with your RTU email address (@rtu.edu.ph)."),
    password: strongPassword,
    confirm: z.string(),
    consent: z.literal(true, { message: "You need to agree to the Privacy Notice to create an account." }),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match." });

export const resetPasswordSchema = z
  .object({ password: strongPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match." });

export const lostReportSchema = z.object({
  title: z.string().trim().min(3, "Give the item a short name, like “Navy blue umbrella”.").max(60),
  category: z.string().min(1, "Choose a category."),
  location: z.string().min(1, "Choose where you last saw it."),
  lostOn: z.string().min(1, "Pick the date you last saw it."),
  description: z
    .string()
    .trim()
    .min(10, "Describe the item in a sentence or two.")
    .max(500)
    .refine(noContactDetails, "Remove contact details or ID numbers from the public description."),
  privateDetails: z
    .string()
    .trim()
    .min(5, "Add at least one detail only the owner would know.")
    .max(500)
    .refine(noContactDetails, "Remove contact details or ID numbers."),
});

export const claimSchema = z.object({
  answers: z
    .array(z.string().trim().min(3, "Answer this question.").max(500).refine(noContactDetails, "Remove contact details or ID numbers."))
    .length(3),
});

export const foundItemSchema = z.object({
  title: z.string().trim().min(3, "Name the item.").max(60),
  category: z.string().min(1, "Choose a category."),
  location: z.string().min(1, "Choose where it was found."),
  foundOn: z.string().min(1, "Pick the date it was found."),
  description: z.string().trim().min(10, "Describe what students will see.").max(500).refine(noContactDetails, "Remove contact details or ID numbers."),
  privateDetails: z.string().trim().min(5, "Record at least one detail a real owner would know.").max(500),
  locationDetail: z.string().trim().max(80).optional(),
  shelfTag: z.string().trim().max(10).optional(),
});

/** First error message per field, for showing under inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
