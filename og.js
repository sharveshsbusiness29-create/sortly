require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

app.use(cors());
app.use(express.json());

/**
 * EXPAND URL
 */
async function expandUrl(url) {

  try {

    const response = await axios.get(url, {
      maxRedirects: 5,
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    return response.request?.res?.responseUrl || url;

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
 */
async function getFacebookData(url) {

  try {

    const finalUrl =
      await expandUrl(url);

    console.log(
      "FINAL FACEBOOK URL:",
      finalUrl
    );

    const response = await axios.get(finalUrl, {

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

    console.log("OG TITLE:", ogTitle?.[1]);
    console.log("PAGE TITLE:", pageTitle?.[1]);
    console.log("DESCRIPTION:", description?.[1]);

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
      title: "Unknown Facebook Video",
      channel: "Facebook"
    };
  }
}

/**
 * API
 */
app.post('/classify', async (req, res) => {

  try {

    const { url } =
      req.body;

    console.log("REQUEST URL:", url);

    const fbData =
      await getFacebookData(url);

    res.json({
      title: fbData.title,
      channel: fbData.channel
    });

  } catch (error) {

    console.log("SERVER ERROR:", error);

    res.status(500).json({
      error: "failed"
    });
  }
});

/**
 * START
 */
app.listen(3000, () => {
  console.log("Server running on port 3000");
});