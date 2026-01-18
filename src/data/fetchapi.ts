import { createServerFn } from '@tanstack/react-start';
import { z } from "zod";

const searchInput = z.object({
  query: z.string(),
  page: z.number().optional(),
  rows: z.number().optional()
});

const itemInput = z.object({
  id: z.string()
});

export const searchIA = createServerFn({ method: "GET" })
  .inputValidator(searchInput)
  .handler(async ({ data }) => {
    const { query, page = 1, rows = 10 } = data;
    const start = (page - 1) * rows;

    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
      query
    )}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=mediatype&rows=${rows}&start=${start}&output=json`;

    const res = await fetch(url);

    const text = await res.text();
    console.log("RAW RESPONSE:", text.slice(0, 500));
    try {
      const result = JSON.parse(text);
      return result.response.docs;
    } catch (err) {
      console.error("Failed to parse JSON:", err);
      return [];
    }
  });

export const getArchiveItem = createServerFn({ method: "GET" })
  .inputValidator(itemInput)
  .handler(async ({ data }) => {
    const { id } = data;
    const url = `https://archive.org/download/${id}/`;
    const res = await fetch(url);
    return await res.json();
  });
