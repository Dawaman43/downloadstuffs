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
    )}&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=mediatype&fl[]=date&fl[]=year&fl[]=description&fl[]=downloads&fl[]=subject&fl[]=collection&rows=${rows}&start=${start}&output=json`;

    const res = await fetch(url);
    if (!res.ok) return [];
    const result = await res.json().catch(() => null);
    if (!result?.response?.docs) return [];
    return result.response.docs;
  });

export const getArchiveItem = createServerFn({ method: "GET" })
  .inputValidator(itemInput)
  .handler(async ({ data }) => {
    const { id } = data;
    const url = `https://archive.org/metadata/${id}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  });
