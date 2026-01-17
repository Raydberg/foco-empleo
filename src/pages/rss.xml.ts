import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';


const parser = new MarkdownIt();

export const GET: APIRoute = async ({ site }) => {
    const blogPosts = await getCollection('blog');

    const sortedPosts = blogPosts.sort(
        (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime()
    );

    return rss({
        title: 'Foco Empleo - Blog de Empleos',
        description: 'Consejos, noticias y recursos sobre búsqueda de empleo y desarrollo profesional en español',
        site: site ?? 'https://focoempleo.com',
        xmlns: {
            media: 'http://search.yahoo.com/mrss/',
        },
        items: sortedPosts.map((post) => ({
            title: post.data.title,
            description: post.data.description,
            pubDate: post.data.pubDate,
            author: post.data.author,
            link: `/blog/${post.slug}/`,

            categories: post.data.tags ? [post.data.tags] : [],
            content: sanitizeHtml(parser.render(post.body), {
                allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
            }),
            // customData: post.data.image
            //     ? `<enclosure url="${new URL(post.data.image.src, site).href}" type="image/jpeg" />`
            //     : '',
            customData: post.data.image
                ? `<media:content type="image/${post.data.image.format === 'png' ? 'png' : 'jpg'}" width="${post.data.image.width}" height="${post.data.image.height}" url="${site + post.data.image.src}"/>`
                : ''
        })),

        customData: `
            <language>es</language>
            <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
            <generator>Foco Empleo</generator>
            <webMaster>focoempleo1@gmail.com (Equipo Foco Empleo)</webMaster>
            <copyright>Copyright ${new Date().getFullYear()} Foco Empleo</copyright>
        `,

        stylesheet: '/styles/rss.xsl',
    });
}