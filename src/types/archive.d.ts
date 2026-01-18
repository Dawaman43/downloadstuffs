export type ArchiveDoc = {
  identifier: string;
  title: string;
  creator?: string;
  mediatype: string;
  date?: string;
  year?: number | string;
  description?: string | string[];
  downloads?: number;
  subject?: string | string[];
  collection?: string | string[];
};
