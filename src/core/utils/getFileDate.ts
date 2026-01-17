import fs from 'fs';
import path from 'path';
import type { CollectionEntry } from 'astro:content';

export function getFileDate(filePath: string): Date {
    try {
        const stats = fs.statSync(filePath);
        return stats.birthtime || stats.mtime;
    } catch (error) {
        return new Date();
    }
}

export function getPubDate(post: CollectionEntry<'blog'>): Date {
    if (post.data.pubDate) {
        return post.data.pubDate;
    }

    const contentDir = path.join(process.cwd(), 'src', 'content', 'blog');
    const filePath = path.join(contentDir, `${post.id}`);

    return getFileDate(filePath);
}
