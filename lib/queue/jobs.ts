export type ScrapeJobData = {
  projectId: string;
  channelHandle: string;
  limit: number; // how many recent shorts to pull
  minViews?: number;
};

export type StitchJobData = {
  clipId: string;
};

export type ScheduleJobData = {
  scheduleId: string;
};

export type PlanJobData = {
  planId: string;
};
