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
Anime
Animals
Art
ASMR
Automotive
Aerospace
Business
Cartoons
Coding
Comedy
Commerce
Crime
Dance
DIY
Education
Fashion
Finance
Fitness
Food
Gaming
Health
Heartbreak
History
Horror
Interviews
Kindness
Lifestyle
Love
Luxury
Magic
MartialArts
Media
Memes
Motivation
Movies
Music
Nature
News
Other
Pets
Philosophy
Photography
Podcasts
Religion
Respect
Science
Series
Social
Sports
Spirituality
Tech
Travel
Uncategorized
Weather


CATEGORY GUIDELINES:


AI:
artificial intelligence, chatgpt, openai, gpt, llm,
machine learning, neural networks, automation,
ai agents, prompts, generative ai

Anime:
anime, naruto, one piece, dragon ball,
attack on titan, demon slayer, jujutsu kaisen,
anime edits, manga, otaku, anime fights

Animals:
wild animals, animal rescues, wildlife,
animal facts, safari, zoo animals,
bbc earth animals, marine animals

Art:
painting, drawing, sketching, digital art,
watercolor, graffiti, illustration,
art process, speedpaint

ASMR:
asmr, whispering, tapping, slime,
soap cutting, satisfying sounds,
sleep sounds, relaxing audio

Automotive:
cars, bikes, motorcycles, supercars,
f1, drifting, engines, tesla, ferrari,
bmw, automotive reviews

Aerospace:
planes, fighter jets, rockets,
satellites, nasa, spacex,
aviation, aircrafts, space exploration

Business:
startups, entrepreneurship, branding,
marketing, ecommerce, side hustles,
company growth, business mindset

Cartoons:
bluey, bingo, spongebob, tom and jerry,
simpsons, family guy, cartoon network,
animated kids shows, disney cartoons,
looney tunes, animated series

Coding:
programming, javascript, python, kotlin,
java, c++, github, web development,
software engineering, coding tutorials

Comedy:
memes, skits, funny videos, trolling,
parody, standup comedy, joke content,
funny reactions, humor

Commerce:
shopping, bought items, sales,
sold out products, trending products,
unboxing, purchases

Crime:
true crime, interrogations, police footage,
mafia, investigations, criminal cases,
court cases, prison stories

Dance:
dance videos, choreography, hip hop dance,
tiktok dances, ballet, breakdancing,
dance performances

DIY:
woodworking, crafts, building projects,
home diy, restoration, handmade projects,
repair videos

Education:
tutorials, explainers, learning,
documentaries, lectures, courses,
maths, science lessons, history lessons

Fashion:
streetwear, outfits, clothing brands,
designer fashion, styling, fashion shows,
fashion hauls

Finance:
investing, stocks, crypto, trading,
passive income, financial advice,
stock market, money investing

Fitness:
gym, workouts, bodybuilding,
exercise, cardio, strength training,
weight loss, fitness motivation

Food:
recipes, cooking, baking,
street food, restaurants, mukbang,
food reviews

Gaming:
minecraft, fortnite, gta, fifa,
fc, valorant, gameplay, esports,
gaming challenges, walkthroughs

Health:
mental health, wellness, nutrition,
medical advice, therapy, healthy living

Heartbreak:
breakups, sadness, divorce,
emotional pain, crying, loneliness,
loss, heartbreak edits

History:
historical events, ancient civilizations,
wars, kings, empires, ww2,
historical documentaries

Horror:
horror, scary, creepy, haunted,
ghosts, paranormal, demons,
jumpscares, analog horror,
backrooms, disturbing videos

Interviews:
interviews, conversations, podcasts,
guest talks, talk shows,
celebrity interviews

Kindness:
helping others, generosity,
heartwarming moments, saving people,
charity, caring moments

Lifestyle:
daily life, routines, skincare,
beauty, glow ups, self care,
house tours, habits, vlogs

Love:
relationships, romance, weddings,
soulmates, dating, romantic moments,
love stories

Luxury:
mansions, yachts, rolex,
bugatti lifestyle, luxury homes,
rich lifestyle, billionaire lifestyle

Magic:
magic tricks, illusions,
magic performances, street magic

MartialArts:
karate, kung fu, taekwondo,
mma training, self defense,
martial arts fights

Media:
internet culture, reactions,
creator content, youtube drama,
fan edits, celebrity culture,
viral content, commentary

Memes:
brainrot, sigma edits,
skibidi, meme edits,
viral memes, absurd humor

Motivation:
discipline, hard work,
success mindset, productivity,
self improvement, grind culture

Movies:
films, cinema, movie trailers,
actors, behind the scenes,
film clips, blockbuster movies

Music:
songs, rap, albums,
music videos, remixes,
concerts, beats, playlists

Nature:
forests, oceans, mountains,
nature scenery, landscapes,
natural disasters, earth documentaries

News:
breaking news, politics,
current affairs, world events,
global updates, news reports

Pets:
cats, dogs, parrots,
cute pets, pet care,
funny pet videos

Philosophy:
stoicism, nihilism,
deep thoughts, existentialism,
philosophical discussions

Photography:
cinematography, cameras,
videography, filmmaking,
editing, colour grading

Podcasts:
long-form conversations,
discussion podcasts,
podcast clips

Religion:
christianity, islam, hinduism,
bible, quran, temples,
churches, religious teachings

Respect:
respect moments, respecting elders,
sportsmanship, respectful acts

Science:
physics, chemistry, biology,
space science, experiments,
scientific discoveries

Series:
tv shows, netflix series,
episodes, web series,
streaming shows

Social:
tiktok trends, influencers,
instagram culture, online trends,
social media content

Sports:
football, basketball, cricket,
ufc, boxing, tennis,
sports highlights, athletes,
matches, goals, tournaments

Spirituality:
manifestation, meditation,
mindfulness, energy healing,
spiritual awakening

Tech:
technology, gadgets,
smartphones, laptops,
software reviews, ai hardware

Travel:
vacations, tourism, flights,
countries, adventures,
travel vlogs

Weather:
storms, rain, snow,
thunder, lightning,
tornadoes, climate
Create a short clean human-readable English title.

Rules:
- ALWAYS translate to English if the title is in another language
- No markdown
- No quotes
- No explanation
- Keep concise
- Make it natural English

- Focus mainly on the TITLE; even if the channel is from a footballer, it could be gaming, therefore it should not be in Sports unless it is actual real-world sports content
-Kindness of someone like a person goes into kindness
-Hard work is motivation
-Sometimes famous people will do challenges for example ronaldo doing football with mr Beast or Mark rober singers as well these should not go to music or sports they should go to media as it is with content creators.
-Try to look at hashtags, if theren't any then use emojis to help you out
- Cold football edits are Sports ONLY if they are focused on real athletes or real football moments (not memes, not creator content)
-things like peoples glow up should come in lifestyle
-things like house tour, dream holiday, dream house,dream car etc. should come in lifestyle
-things like finding the right person you deserve is love, finding my soulmate is examples of love
-girls or boys giving loving looks is love
-things not easily built is motivation
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