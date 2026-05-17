import { z } from "zod";

const CRON_5_FIELD = /^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/;

export const querySchema = z.object({
  token: z.string().min(1, "El Query token és obligatori"),
  csv: z.boolean(),
});

export const sourceSchema = z.object({
  mode_report_token: z.string().min(1, "El Mode report és obligatori"),
  queries: z
    .array(querySchema)
    .min(1, "Cal almenys una Query dins de cada Source"),
});

export const briefSchema = z.object({
  name: z.string().min(1, "El Brief Name és obligatori"),
  published: z.boolean(),
  schedule: z
    .string()
    .min(1, "El Schedule és obligatori")
    .regex(CRON_5_FIELD, "El Schedule ha de ser una expressió cron de 5 camps"),
  slack_channel: z.string().min(1, "El Slack Channel és obligatori"),
  reference_link: z
    .string()
    .refine(
      (v) => v === "" || /^https?:\/\/.+/i.test(v),
      "El Reference link ha de començar amb http:// o https://"
    ),
  sources: z.array(sourceSchema).min(1, "Cal almenys un Source"),
  prompt: z.string().min(1, "El Prompt és obligatori"),
  owner_email: z.string().email().nullable().optional(),
});

export type Query = z.infer<typeof querySchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Brief = z.infer<typeof briefSchema>;

export type BriefListItem = {
  filename: string;
  name: string;
  published: boolean;
  schedule: string;
  slack_channel: string;
  source_count: number;
  query_count: number;
  sha: string;
};
