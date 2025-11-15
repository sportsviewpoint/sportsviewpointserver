import axios from "axios";
import * as cheerio from "cheerio";

function filterArticles(data, datePosted) {
  // Titles you want to filter out (the "navigation" titles)
  console.log("filtering articles" + datePosted);
  const excludedTitles = new Set([
    "Home",
    "Transfers",
    "Premier League",
    "La Liga",
    "MLS",
    "Champions League",
    "Europa League",
    "Club World Cup",
    "Arsenal",
    "Chelsea",
    "Liverpool",
    "Manchester City",
    "Manchester United",
    "Barcelona",
    "Real Madrid",
    "Bayern Munich",
    "Paris Saint-Germain",
    "Inter Miami",
    "LA Galaxy",
    "More Teams",
    "Ballon d’Or",
    "Women's",
    "FPL",
    "EA FC",
    "Soccer 101",
    "Futures",
  ]);

  return data.filter(
    (item) => !excludedTitles.has(item.title) && item.datePosted === datePosted
  );
}

export async function FETCH_ARTICLE_LINKS(selecteddate, category) {
  console.log(selecteddate);
  console.log("Getting Links for "+ category.category_name)
  try {
    const allArticles = [];
    const numberOfPages = 10; // Start with 1 page for testing
    let searchdate = selecteddate;

    for (let page = 1; page <= numberOfPages; page++) {
        let url =  `https://www.si.com/${category.category_name}/archive?page=${page}`
        console.log(url)
      const { data: html } = await axios.get(url)
      
      
      const $ = cheerio.load(html);

      // Method 1: Look for article links in the main content
      const articleLinks = $('a[href*="/soccer/"]')
        .filter((_, el) => {
          const href = $(el).attr("href");
          // Filter out navigation links and keep only article links
          return (
            href &&
            href.includes(`/${category.category_name}/`) &&
            !href.includes(`/${category.category_name}/archive`) &&
            !href.includes(`/${category.category_name}/?`) &&
            href.split("/").length > 4
          ); // Article URLs have more path segments
        })
        .map((_, el) => {
          const $el = $(el);
          const href = $el.attr("href");
          const fullUrl = href.startsWith("http")
            ? href
            : `https://www.si.com${href}`;

          // Try to find title from various possible locations
          let title =
            $el.attr("title") ||
            $el.find("h1, h2, h3, h4").first().text() ||
            $el.text();

          // Clean up the title
          title = title.trim().replace(/\s+/g, " ");

          return {
            title: title || "No title found",
            link: fullUrl,
            datePosted: new Date().toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            }),
          };
        })
        .get();

      // Method 2: Alternative approach - look for specific CSS classes or patterns
      const alternativeLinks = $(
        '[class*="card"], [class*="article"], [class*="story"]'
      )
        .find('a[href*="/soccer/"]')
        .map((_, el) => {
          const $el = $(el);
          const href = $el.attr("href");
          if (!href || href.includes("/soccer/archive")) return null;

          const fullUrl = href.startsWith("http")
            ? href
            : `https://www.si.com${href}`;
          const title =
            $el.text().trim() || $el.attr("title") || "No title found";

          return {
            title: title,
            link: fullUrl,
            datePosted: new Date().toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            }),
          };
        })
        .get()
        .filter((link) => link !== null);

      // Combine results from both methods and remove duplicates
      const combinedLinks = [...articleLinks, ...alternativeLinks];
      const uniqueLinks = combinedLinks.filter(
        (link, index, self) =>
          index === self.findIndex((l) => l.link === link.link)
      );

      allArticles.push(...uniqueLinks);

      // If no links found on this page, break the loop
      if (uniqueLinks.length === 0) {
        console.log(`No articles found on page ${page}, stopping pagination`);
        break;
      }
    }

    console.log(`Found ${allArticles.length} articles for ${category.category_name.toUpperCase()}`);
    let filteredArticles = filterArticles(allArticles, searchdate);
    console.log(`Found ${filteredArticles.length} filtered articles`);
    return { success: true, articles: filteredArticles };
  } catch (error) {
    console.log("Error scraping SI:", error.message);
    return { success: false, error: error.message };
  }
}

export async function FETCH_NEWS_ARTICLE_DETAILS(url) {
    console.log (url)
  try {
    if (!url || !url.startsWith('https://www.si.com/')) {
      return { success: false, error: 'Invalid or missing URL' };
    }

    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr('content') || $('title').text();

    const image = $('meta[property="og:image"]').attr('content') || null;

    const imageAlt =
      $('meta[property="og:description"]').attr('content') ||
      $('img[alt]').first().attr('alt') ||
      '';

    const rawDate = $('meta[property="article:published_time"]').attr('content');

    const datePosted = rawDate
      ? new Date(rawDate).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : null;

    const articleSection = $('body').html();

    return {
      success: true,
      data: {
        title,
        originalLink:url,
        image,
        imageAlt,
        datePosted,
        articleHtml: articleSection,
      },
    };
  } catch (error) {
    console.error(error);
    return { success: false, error: error.message };
  }
}

