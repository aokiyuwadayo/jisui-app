import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// 期限切れの OAuth を掃除する（日本時間の朝3時）
crons.daily("oauth-cleanup", { hourUTC: 18, minuteUTC: 0 }, internal.oauth.cleanup);

// 操作ログと在庫の写しを BigQuery へ（日本時間の朝4時）
crons.daily("bigquery-export", { hourUTC: 19, minuteUTC: 0 }, internal.bigquery.run);

export default crons;
