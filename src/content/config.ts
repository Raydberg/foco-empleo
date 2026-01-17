import { defineCollection, z } from 'astro:content';

const blogCollection = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    title: z.string(),
    description: z.string().optional(),
    pubDate: z.date().optional(),
    image: image().optional(),
    tags: z.string().optional(),
  }),
});

export const collections = {
  blog: blogCollection,
};