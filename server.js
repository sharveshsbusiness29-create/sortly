require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const Groq = require('groq-sdk');
const app = express();

app.use(cors());
app.use(express.json());


app.get('/', (req, res) => {
  res.send('Sortly backend running');
});


const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * EXPAND URL
 */
async function expandUrl(url) {

  try {

    const response = await axios.get(url, {

      maxRedirects: 5,
      timeout: 10000,

      headers: {
        "User-Agent":
          "Mozilla/5.0"
      }

    });

    return (
      response.request?.res?.responseUrl ||
      url
    );

  } catch (error) {

    console.log(
      "URL EXPAND FAILED:",
      error.message
    );

    return url;
  }
}

/**
 * FACEBOOK FETCH
 * (OLD WORKING VERSION)
 */
async function getFacebookData(url) {

  try {

    const finalUrl =
      await expandUrl(url);

    console.log(
      "FINAL FACEBOOK URL:",
      finalUrl
    );

    const response =
      await axios.get(finalUrl, {

        headers: {
          "User-Agent":
            "Mozilla/5.0"
        }

      });

    const html =
      response.data;

    const ogTitle =
      html.match(
        /<meta property="og:title" content="([^"]*)"/
      );

    const pageTitle =
      html.match(
        /<title>(.*?)<\/title>/
      );

    const description =
      html.match(
        /<meta name="description" content="([^"]*)"/
      );

    console.log(
      "OG TITLE:",
      ogTitle?.[1]
    );

    console.log(
      "PAGE TITLE:",
      pageTitle?.[1]
    );

    console.log(
      "DESCRIPTION:",
      description?.[1]
    );

    return {

      title:
        ogTitle?.[1] ||
        pageTitle?.[1] ||
        description?.[1] ||
        "Unknown Facebook Video",

      channel:
        "Facebook"
    };

  } catch (error) {

    console.log(
      "FACEBOOK FETCH FAILED:",
      error.message
    );

    return {

      title:
        "Unknown Facebook Video",

      channel:
        "Facebook"
    };
  }
}

/**
 * INSTAGRAM FETCH
 * (YOUR WORKING VERSION)
 */
async function getInstagramData(url) {

  try {

    console.log(
      "FETCHING INSTAGRAM:",
      url
    );

    const response =
      await axios.get(url, {

        headers: {
          "User-Agent":
            "Mozilla/5.0"
        },

        timeout:
          10000
      });

    const html =
      response.data;

    /**
     * OG DESCRIPTION
     */
    const ogDesc =
      html.match(
        /<meta property="og:description" content="([^"]*)"/
      );

    /**
     * OG TITLE
     */
    const ogTitle =
      html.match(
        /<meta property="og:title" content="([^"]*)"/
      );

    /**
     * PAGE TITLE
     */
    const pageTitle =
      html.match(
        /<title>(.*?)<\/title>/
      );

    console.log(
      "IG OG DESC:",
      ogDesc?.[1]
    );

    console.log(
      "IG OG TITLE:",
      ogTitle?.[1]
    );

    console.log(
      "IG PAGE TITLE:",
      pageTitle?.[1]
    );

    let cleanTitle =

      ogDesc?.[1] ||
      ogTitle?.[1] ||
      pageTitle?.[1] ||
      "Unknown Instagram Post";

    /**
     * CLEAN NOISE
     */
    cleanTitle =
      cleanTitle

      .replace(
        /\s*on Instagram:.*$/i,
        ""
      )

      .replace(
        /\s*Instagram\s*•.*$/i,
        ""
      )

      .replace(
        /\s*shared a post.*$/i,
        ""
      )

      .trim();

    return {

      title:
        cleanTitle,

      channel:
        "Instagram"
    };

  } catch (error) {

    console.log(
      "INSTAGRAM FETCH FAILED:",
      error.message
    );

    return {

      title:
        "Unknown Instagram Post",

      channel:
        "Instagram"
    };
  }
}

/**
 * TIKTOK FETCH
 */
async function getTikTokData(url) {

  try {

    const finalUrl =
      await expandUrl(url);

    console.log(
      "FINAL TIKTOK URL:",
      finalUrl
    );

    const response =
      await axios.get(finalUrl, {

        timeout: 10000,

        headers: {

          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",

          "Accept-Language":
            "en-US,en;q=0.9"
        }

      });

    const html =
      response.data;

    const descMatch =
      html.match(
        /"desc":"(.*?)"/
      );

    const authorMatch =
      html.match(
        /"author":"(.*?)"/
      );

    const ogTitle =
      html.match(
        /<meta property="og:title" content="([^"]*)"/
      );

    const title =

      descMatch?.[1]
        ?.replace(/\\n/g, ' ')
        ?.replace(/\\"/g, '"') ||

      ogTitle?.[1] ||

      "Unknown TikTok Video";

    const author =
      authorMatch?.[1] ||
      "Unknown";

    console.log(
      "TIKTOK TITLE:",
      title
    );

    console.log(
      "TIKTOK AUTHOR:",
      author
    );

    return {

      title,
      author,

      channel:
        "TikTok"
    };

  } catch (error) {

    console.log(
      "TIKTOK FETCH FAILED:",
      error.message
    );

    return {

      title:
        "Unknown TikTok Video",

      author:
        "Unknown",

      channel:
        "TikTok"
    };
  }
}

/**
 * YOUTUBE FETCH
 */
async function getYouTubeData(url) {
  try {
    const res = await axios.get(
      "https://www.youtube.com/oembed",
      {
        params: {
          url,
          format: "json"
        },
        timeout: 10000
      }
    );

    return {
      title: res.data.title,
      channel: res.data.author_name
    };

  } catch (error) {
    console.log("YOUTUBE FAILED:", error.message);

    return {
      title: "Unknown YouTube Video",
      channel: "YouTube"
    };
  }
}
/**
 * API
 */

async function translateToEnglish(text) {

  try {

    const res = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `
Translate the following text into natural English.

Rules:
- Only return the translation
- No explanation
- No quotes
- Keep meaning accurate

Text:
${text}
`
        }
      ],
      model: "llama-3.3-70b-versatile"
    });

    return res.choices[0].message.content
      .replace(/```/g, '')
      .trim();

  } catch (err) {

    console.log("TRANSLATION FAILED:", err.message);

    return text; // fallback
  }
}

app.post('/classify', async (req, res) => {

  try {

    const { url } =
      req.body;

    console.log(
      "REQUEST URL:",
      url
    );

    let data;

    /**
     * INSTAGRAM
     */
    if (
      url.includes(
        "instagram.com"
      )
    ) {

      data =
        await getInstagramData(url);
    }

    /**
 * YOUTUBE
 */
else if (

  url.includes("youtube.com") ||
  url.includes("youtu.be")

) {

  data =
    await getYouTubeData(url);
}

    /**
     * TIKTOK
     */
    else if (
      url.includes(
        "tiktok.com"
      )
    ) {

      data =
        await getTikTokData(url);
    }

    /**
     * FACEBOOK
     */
    else if (

      url.includes(
        "facebook.com"
      ) ||

      url.includes(
        "fb.watch"
      )

    ) {

      data =
        await getFacebookData(url);
    }

    /**
     * UNKNOWN
     */
    else {

      data = {

        title:
          "Unsupported URL",

        channel:
          "Unknown"
      };
    }

    /**
 * GROQ CLASSIFICATION
 */
const completion =
  await groq.chat.completions.create({

    messages: [
      {
        role: 'user',
        content: `

Return ONLY valid JSON.

Choose ONE folder from this list ONLY:

AI
Art
Automotive
Business
Cartoons
Coding
Education
Fitness
Food
Gaming
Health
Interviews
Kindness
Love
Lifestyle
Media
Comedy
Magic
Motivation
Movies
Music
Nature
News
Podcasts
Social
Sports
Tech
Travel
Fashion
Photography
Series
Spirituality
Other
Uncategorized
Weather


CATEGORY GUIDELINES:


AI:
artificial intelligence, chatgpt, openai, gpt, llm,
machine learning, neural networks, automation, agents, prompts

Art:
picture, painting, drawing, watercolours, grafiti

Automotive:
cars, bikes, motorcycles, supercars, f1, racing,
engines, drifting, tesla, bmw, ferrari, automotive reviews

Business:
startups, entrepreneurship, marketing, ecommerce,
sales, money making, investing, branding, finance, side hustles

Cartoons:
bluey, bingo, bandit heeler, chilli heeler, blue heeler,
spongebob squarepants, patrick star, squidward, mr krabs,
tom and jerry, bugs bunny, daffy duck, mickey mouse, donald duck, goofy,
minions, despicable me, gru, shrek, kung fu panda, madagascar,
rick and morty, simpsons, homer simpson, bart simpson, family guy,
south park, stan marsh, kyle broflovski, eric cartman, kenny mccormick,
adventure time, finn the human, jake the dog,
teen titans go, ben 10 original series, gwen tennyson, four arms,
regular show, mordecai, rigby,
gravity falls, dipper pines, mabel pines,
looney tunes, cartoon network originals,
animated kids series, children's animation, preschool animation,
full cartoon episode, cartoon episode clip, animated series episode,

Coding:
programming, software engineering, javascript,
python, java, kotlin, c++, github, APIs, web development, apps

Education:
tutorials, explainers, documentaries, science,
history, maths, lectures, courses, learning content

Fitness:
gym, workouts, bodybuilding, exercise,
strength training, cardio, weight loss, nutrition training

Food:
recipes, cooking, chefs, restaurants,
street food, baking, food reviews, mukbang

Gaming:
video games, gameplay, esports, streaming,
minecraft, fortnite, valorant, gta, fifa, fc, efootball,
gaming challenges, gaming collabs, walkthroughs

IMPORTANT:
- FIFA / FC / eFootball = Gaming ONLY

Heartbreak:
sad, divorce, breakup, bullying, hurt, crying out of sadness, loss

Health:
mental health, wellness, medical, therapy,
nutrition, healthy living, self-care

Kindness:
kindness, heartwarming, helping others out, protecting others, giving

Love:
relationships, love, marriage, dream partner, wedding, valentine's day

Lifestyle:
daily life, routines, relationships, self improvement,
fashion lifestyle, beauty, skincare, habits, glowup, house

Media:
entertainment culture, influencer content,
youtube drama, celebrity news, reactions,
internet culture, viral content, commentary, fan edits

Comedy:
memes, skits, pranks, trolling, parody,
standup, funny compilations, joke content, humor, shitposts, tickles

Motivation:
discipline, success, self improvement,
mindset, productivity, inspiration, grind culture

Movies:
films, movie trailers, cinema, actors,
blockbusters, film clips, production, behind the scenes

Series:
tv shows, episodes, streaming series,
netflix shows, web series, serials

Magic:
magic tricks, magic shows

Music:
songs, rap, albums, beats, playlists,
concerts, remixes, music videos

Nature:
nature, animals, plants, new animal species, bbc earth

News:
breaking news, world events, politics,
current affairs, global updates, reports

Podcasts:
podcasts, long-form conversations,
talk shows, interviews, discussions

Social:
tiktok, instagram, influencers,
content creators, online culture, social media trends

Sports:
real-world sports only:
football matches, basketball, cricket, boxing, UFC,
tennis, tournaments, leagues, highlights, goals, athletes

IMPORTANT:
- REAL sports events ONLY
- NO sports video games
- NO creator challenges with athletes
- NO memes/reactions belong here

Tech:
technology, gadgets, software, smartphones,
laptops, reviews, AI hardware, apps, innovations

Travel:
travel, countries, flights, hotels,
vacations, tourism, adventures

Fashion:
streetwear, outfits, clothing, brands,
style, designer, fashion shows

Photography:
cinematography, cameras, videography,
filmmaking, editing, colour grading, visual storytelling

Spirituality:
meditation, mindfulness, religion,
manifestation, spirituality, self-awareness

Interviews:
interviews, podcasts interviews,
talk shows, guest conversations, conversations

Weather:
weather, climate, temperature, snow, sun, rain, ice, thunder, lightning, storm, tornado

Create a short clean human-readable English title.

Rules:
- ALWAYS translate to English if the title is in another language
- No markdown
- No quotes
- No explanation
- Keep concise
- Make it natural English

- Focus mainly on the TITLE; even if the channel is from a footballer, it could be gaming, therefore it should not be in Sports unless it is actual real-world sports content
-Sometimes famous people will do challenges for example ronaldo doing football with mr Beast or Mark rober singers as well these should not go to music or sports they should go to media as it is with content creators.
-Try to look at hashtags, if theren't any then use emojis to help you out
- Cold football edits are Sports ONLY if they are focused on real athletes or real football moments (not memes, not creator content)
-things like peoples glow up should come in lifestyle
-things like house tour, dream holiday, dream house,dream car etc. should come in lifestyle
-success on its own is lifestyle however turning things such as insults into success or taking steps to success like becoming successful should be in motivation not other should be motivation
-funny moments, reactions, hilarious reactions should come up in comedy
-cute moments should come up in media
-try to use other folder minimally things lie nonchalant celebrations normally fall unser sports so you can kind of roughly guess, but if u have no clue then only then put it in other
-music videos of a movie especially indian ones should come under music not movie
-clothing brands such as primark, next should come in fashion not in lifestyle, things like style for 30 pounds etc. is fashion not lifestyle
-make sure sports are matches and edits of footballers, football skills or shooting practice any thing else should come in media


- Use CHANNEL only as supporting context, never as the main deciding factor
- Understand FULL CONTEXT of the title

- NEVER default to Music under any circumstances
- If the category is unclear, ambiguous, or mixed, choose the most logical real-world interpretation
- If no category clearly fits, ALWAYS use Other (do NOT guess Music or any popular category)

- A football challenge with a content creator is Media, not Sports
- A funny prank is Comedy, not Media
- Sports is strictly real matches, highlights, professional athletes, tournaments, or real gameplay of physical sports
- Gaming content (FIFA, FC, eFootball, Fortnite, etc.) is Gaming, not Sports

- If a video title has no clear AI/tech meaning, do NOT assume Photography; only use Photography for actual filming, cinematography, cameras, editing, or visual production content

- Interviews are NOT automatically News; classify based on topic context

- If unsure of category, use Other (do NOT guess a random category)

- "Live" does NOT automatically mean News

- Entertainment-style creator content belongs in Media

- Sometimes movie titles (e.g. Cars) belong in Movies, not Automotive

- Look for production companies or film indicators in titles to classify Movies correctly

- Compilation content (e.g. funny compilations) belongs in Media

- If the title is in another language, translate it to English mentally before categorising

-Footballer skills should come under football for example

-If a video says chat with someone or conversation it means interview

-Look at for popular character names such as cartoon ones in the title to sort them properly for example bluey and bingo would come in cartoons

- FINAL RULE:
  If you cannot confidently classify the content into a category based on the title, ALWAYS return:
  "Other"
Example:
{
  "folder": "Music"
}

Title: ${data.title}
Channel: ${data.channel}

`
      }
    ],

    model:
      'llama-3.3-70b-versatile'
});

let result =
  completion.choices[0]
  .message.content;

result = result

  .replace(/```json/g, '')
  .replace(/```/g, '')
  .trim();

let folder =
  "Uncategorized";

try {

  folder =
    JSON.parse(result).folder ||
    "Uncategorized";

} catch (e) {

  console.log(
    "FOLDER JSON FAILED:",
    result
  );
}

/**
 * CLEAN TITLE
 */
const titleCompletion =
  await groq.chat.completions.create({

    messages: [
      {
        role: 'user',
        content: `

Create a short clean english human-readable title.

Rules:
- No markdown
- No quotes
- No explanation
- Keep concise
-make it always in english even if the video isn't make the title english
Original Title:
${data.title}

Channel:
${data.channel}

`
      }
    ],

    model:
      'llama-3.3-70b-versatile'
});

let aiTitle =
  titleCompletion.choices[0]
  .message.content

  .replace(/```/g, '')
  .trim();

/**
 * FINAL RESPONSE
 */
res.json({

  folder,

  aiTitle,

  originalTitle:
    data.title,

  channel:
    data.channel,

  timestamp:
    new Date().toISOString()
});

  } catch (error) {

    console.log(
      "SERVER ERROR:",
      error
    );

    res.status(500).json({

      error:
        "failed"
    });
  }
});

/**
 * START SERVER
 */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});