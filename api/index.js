require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const feedCache = new Map();
const FEED_CACHE_TTL = 3 * 60 * 1000;
let simpleFeedCache = { data: null, timestamp: 0 };
const FEED_CACHE_TTL_SIMPLE = 120000;

app.get('/api/news', async (req, res) => {
  try {
    const q = req.query.q || 'artificial intelligence';
    const pageSize = req.query.pageSize || 10;
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&pageSize=${pageSize}&language=en&sortBy=publishedAt&apiKey=${process.env.NEWSAPI_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.status === 'error') return res.status(500).json({ error: data.message });
    const articles = (data.articles || []).map((article, i) => ({
      id: i + 1, title: article.title || 'Untitled', source: article.source?.name || 'Unknown',
      date: new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      category: 'AI', brief: article.description || 'No description available.', impact: 'medium', tags: ['ai'],
      url: article.url, content: (article.content || article.description || article.title).replace(/\[\+\d+ chars\]$/, '')
    }));
    res.json(articles);
  } catch (err) { res.status(500).json({ error: 'Failed to fetch news' }); }
});

app.post('/api/summarize', async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'title and content are required' });
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: 'You are an AI news analyst. Given a news article title and content, provide a concise 2-3 paragraph summary and 3-4 key takeaways. Respond in JSON format with keys "summary" (string) and "takeaways" (array of strings).' }, { role: 'user', content: `Title: ${title}\n\nContent: ${content}` }], temperature: 0.5, response_format: { type: 'json_object' } })
    });
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    res.json(JSON.parse(data.choices[0].message.content));
  } catch (err) { res.status(500).json({ error: 'Failed to summarize' }); }
});

app.post('/api/generate', async (req, res) => {
  try {
    const { topic, lang = 'en' } = req.body;
    if (!topic) return res.status(400).json({ error: 'topic is required' });
    const sysPrompt = lang === 'ar' ? 'أنت منشئ محتوى. قم بتقديم ملخص من 2-3 فقرات و4 نقاط رئيسية حول الموضوع المطلوب. يجب أن يكون الملخص غني بالمعلومات ومناسباً لكاروسيل وسائل التواصل الاجتماعي. أعد الإجابة بصيغة JSON بمفتاحي "summary" (نص) و "takeaways" (مصفوفة من 4 نصوص).' : 'You are a content creator. Provide a well-researched 2-3 paragraph summary and 4 key takeaways about the given topic. The summary should be informative, engaging, and suitable for a social media carousel. Respond in JSON format with keys "summary" (string) and "takeaways" (array of 4 strings).';
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: `Topic: ${topic}` }], temperature: 0.7, response_format: { type: 'json_object' } })
    });
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    res.json(JSON.parse(data.choices[0].message.content));
  } catch (err) { res.status(500).json({ error: 'Failed to generate content' }); }
});

app.post('/api/explore', async (req, res) => {
  try {
    const { topic, lang = 'en' } = req.body;
    if (!topic) return res.status(400).json({ error: 'topic is required' });
    const newsUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(topic)}&pageSize=12&sortBy=relevancy&language=en&apiKey=${process.env.NEWSAPI_KEY}`;
    const newsRes = await fetch(newsUrl);
    const newsData = await newsRes.json();
    const rawArticles = (newsData.articles || []).slice(0, 10).map(a => ({ title: a.title || 'Untitled', source: a.source?.name || 'Unknown', date: new Date(a.publishedAt).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' }), brief: (a.description || a.title || 'No description').replace(/\[\+\d+ chars\]$/, ''), url: a.url, imageUrl: a.urlToImage }));
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: lang === 'ar' ? 'أنت محلل أخبار. قم بتحليل الموضوع التالي واقترح 4-5 مواضيع فرعية تمثل أحدث التطورات والاتجاهات فيه. أعد الإجابة بصيغة JSON بمفتاح "subtopics" (مصفوفة نصوص).' : 'You are a news analyst. Analyze the following topic and suggest 4-5 subtopics that represent the latest developments and trends within it. Respond in JSON format with key "subtopics" (array of strings).' }, { role: 'user', content: `Topic: ${topic}` }], temperature: 0.7, response_format: { type: 'json_object' } })
    });
    const groqData = await groqRes.json();
    if (groqData.error) return res.status(500).json({ error: groqData.error.message });
    const { subtopics } = JSON.parse(groqData.choices[0].message.content);
    if (!subtopics || !subtopics.length) return res.status(500).json({ error: 'No subtopics generated' });
    const articles = rawArticles.map(article => {
      const text = (article.title + ' ' + article.brief).toLowerCase();
      let bestSub = subtopics[0], bestScore = 0;
      for (const st of subtopics) {
        const keywords = st.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const score = keywords.filter(kw => text.includes(kw)).length;
        if (score > bestScore) { bestScore = score; bestSub = st; }
      }
      return { ...article, subtopic: bestSub };
    });
    res.json({ topic, subtopics, articles: articles.slice(0, 12) });
  } catch (err) { res.status(500).json({ error: 'Failed to explore topic' }); }
});

app.post('/api/explore-detail', async (req, res) => {
  try {
    const { topic, subtopic, lang = 'en' } = req.body;
    if (!topic || !subtopic) return res.status(400).json({ error: 'topic and subtopic are required' });
    const sysPrompt = lang === 'ar' ? 'أنت خبير في الموضوع المحدد. قم بتقديم تحليل مفصل من 2-3 فقرات عن هذا الموضوع الفرعي و4 نقاط رئيسية. كن دقيقاً وحديثاً في المعلومات. أعد الإجابة بصيغة JSON بمفتاحي "summary" (نص) و "takeaways" (مصفوفة من 4 نصوص).' : 'You are an expert on the given topic. Provide a detailed 2-3 paragraph analysis of this subtopic and 4 key takeaways. Be accurate and up-to-date. Respond in JSON format with keys "summary" (string) and "takeaways" (array of 4 strings).';
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: `Topic: ${topic}\nSubtopic: ${subtopic}\n\nProvide an up-to-date analysis of recent developments in this area.` }], temperature: 0.7, response_format: { type: 'json_object' } })
    });
    const groqData = await groqRes.json();
    if (groqData.error) return res.status(500).json({ error: groqData.error.message });
    res.json(JSON.parse(groqData.choices[0].message.content));
  } catch (err) { res.status(500).json({ error: 'Failed to generate detailed content' }); }
});

app.post('/api/carousel', async (req, res) => {
  try {
    const { title, summary, takeaways, source, date, lang = 'en' } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    const isAr = lang === 'ar';
    const CAROUSEL_SYSTEM_PROMPT = isAr ? `**مهم جداً: اكتب جميع النصوص بالعربية الفصحى البسيطة فقط. لا تكتب أي كلمة بالإنجليزية مطلقاً حتى العناوين والأرقام والكلمات المختصرة.**

أنت خبير في كتابة محتوى السوشيال ميديا متخصص في الكاروسيل.

**قاعدة ذهبية: يجب أن تكون جميع النصوص والعناوين في الكاروسيل باللغة العربية حصراً بدون استثناء، مهما كانت لغة المحتوى المُدخل.**

مهمتك: تحويل الخبر المعطى إلى كاروسيل احترافي جاهز للنشر على Instagram.

هيكل الكاروسيل الإلزامي (بالترتيب):

[الشريحة 1 — العنوان الجاذب]
عنوان 3-7 كلمات يوقف الـ scroll فوراً. رقم صادم، سؤال مباشر، أو وعد واضح. لا معلومات إضافية. لا أي كلمة إنجليزية.

[الشريحة 2 — المشكلة]
عنوان + وصف المشكلة بلغة الجمهور. من جملتين إلى ثلاث جمل واضحة، لا حلول هنا. اجعل القارئ يحس "هذا أنا!".

[الشرائح 3 إلى 6 — نقاط المحتوى الأساسي]
كل شريحة = فكرة واحدة فقط. عنوان قصير + شرح مفصل من 40 إلى 70 كلمة. أضف مثالاً أو رقماً كلما أمكن.
كل شريحة تنتهي بـ cliffhanger يدفع للتالية: "لكن الأهم..." / "والأصعب من هذا..." / "لكن ثمة شيء أكبر..."

[الشريحة — نصيحة عملية]
عنوان "💡 نصيحة عملية" + خطوة عملية واحدة يطبقها القارئ اليوم. تبدأ بفعل أمر. اذكر النتيجة المتوقعة بوضوح. من 40 إلى 70 كلمة.

[الشريحة الأخيرة — الدعوة للتفاعل]
عنوان + طلب واحد فقط (حفظ أو مشاركة أو تعليق). مرتبط بالموضوع، ليس عاماً.

قواعد الكتابة:
- لغة تفاعلية: غير رسمية، مباشرة، محادثاتية، بالعربية فقط
- ممنوع: مقدمات طويلة، حشو، تكرار أفكار، ختام ضعيف، أي كلمة إنجليزية
- الشريحة الأولى تحدد إذا سيكمل القارئ، والأخيرة تحدد إذا سيتفاعل

أعد الإجابة بصيغة JSON بهذا الشكل بالضبط:
{
  "slides": [
    { "type": "hook", "title": "عنوان الـ hook هنا بالعربية فقط" },
    { "type": "problem", "title": "عنوان المشكلة بالعربية", "body": "شرح مفصل من 40-70 كلمة + cliffhanger بالعربية" },
    { "type": "point", "title": "عنوان النقطة بالعربية", "body": "شرح مفصل من 40-70 كلمة + cliffhanger بالعربية" },
    { "type": "point", "title": "عنوان النقطة بالعربية", "body": "شرح مفصل من 40-70 كلمة + cliffhanger بالعربية" },
    { "type": "point", "title": "عنوان النقطة بالعربية", "body": "شرح مفصل من 40-70 كلمة + cliffhanger بالعربية" },
    { "type": "point", "title": "عنوان النقطة بالعربية", "body": "شرح مفصل من 40-70 كلمة + cliffhanger بالعربية" },
    { "type": "tip", "title": "💡 نصيحة عملية", "body": "شرح مفصل من 40-70 كلمة بالعربية" },
    { "type": "cta", "title": "عنوان الختام بالعربية", "body": "نص الدعوة للتفاعل المرتبط بالموضوع بالعربية" }
  ]
}` : `You are a social media content expert specialized in carousel posts.
Your task: Transform the given news article into a professional Instagram-ready carousel.

MANDATORY CAROUSEL STRUCTURE (in order):

[SLIDE 1 — HOOK]
3-7 word title that stops the scroll instantly. Shocking number, direct question, or clear promise. No extra info.

[SLIDE 2 — PROBLEM]
Title + describe the pain point in the audience's language. 2-3 clear sentences, no solutions yet. Make the reader think "That's me!"

[SLIDES 3-6 — CORE CONTENT POINTS]
Each slide = ONE idea only. Short title + 40-70 words of detailed explanation. Add example or specific number when possible.
Each slide ends with a cliffhanger: "But the real issue is..." / "And the hardest part..." / "But there's something bigger..."

[SLIDE — ACTIONABLE TIP]
Title "💡 Actionable Tip" + one practical step the reader can apply today. Start with an action verb. State the expected result clearly. 40-70 words of detailed explanation.

[LAST SLIDE — CTA]
Title + one request only (save, share, or comment). Must be topic-specific, not generic.

Writing rules:
- Instagram tone: informal, direct, conversational
- Forbidden: long intros, filler, repeated ideas, weak ending
- First slide determines if they keep reading. Last slide determines if they engage.

Respond ONLY in JSON with this exact structure:
{
  "slides": [
    { "type": "hook", "title": "hook title here" },
    { "type": "problem", "title": "problem title", "body": "40-70 words of detailed explanation + cliffhanger" },
    { "type": "point", "title": "point title", "body": "40-70 words of detailed explanation + cliffhanger" },
    { "type": "point", "title": "point title", "body": "40-70 words of detailed explanation + cliffhanger" },
    { "type": "point", "title": "point title", "body": "40-70 words of detailed explanation + cliffhanger" },
    { "type": "point", "title": "point title", "body": "40-70 words of detailed explanation + cliffhanger" },
    { "type": "tip", "title": "💡 Actionable Tip", "body": "40-70 words of detailed explanation + practical step" },
    { "type": "cta", "title": "closing title", "body": "topic-specific CTA text" }
  ]
}`;

    const userContent = isAr ? `عنوان الخبر: ${title}\n\nالملخص: ${summary || 'غير متوفر'}\n\nأهم النقاط:\n${(takeaways || []).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nالمصدر: ${source || 'غير معروف'} — ${date || ''}\n\nحول هذا الخبر إلى كاروسيل احترافي.` : `Article Title: ${title}\n\nSummary: ${summary || 'Not available'}\n\nKey Takeaways:\n${(takeaways || []).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nSource: ${source || 'Unknown'} — ${date || ''}\n\nTransform this article into a professional carousel.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: CAROUSEL_SYSTEM_PROMPT }, { role: 'user', content: userContent }], temperature: 0.7, response_format: { type: 'json_object' } })
    });
    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const result = JSON.parse(data.choices[0].message.content);
    if (!result.slides || !Array.isArray(result.slides)) return res.status(500).json({ error: 'Invalid carousel structure from AI' });
    res.json(result);
  } catch (err) { res.status(500).json({ error: 'Failed to generate carousel' }); }
});

app.get('/api/feed', async (req, res) => {
  try {
    const category = req.query.category || 'all';
    if (category === 'all' && simpleFeedCache.data && Date.now() - simpleFeedCache.timestamp < FEED_CACHE_TTL_SIMPLE) return res.json(simpleFeedCache.data);
    const cacheKey = `feed_${category}`;
    const cached = feedCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < FEED_CACHE_TTL) return res.json(cached.data);
    const topicMap = { technology: 'technology AI software startup cybersecurity', science: 'science space biology physics climate research', health: 'health medicine wellness fitness nutrition', business: 'business finance economy startup market', sports: 'sports football basketball tennis olympics', world: 'world politics education environment news' };
    const categories = ['technology', 'science', 'health', 'business', 'sports', 'world'];
    const catList = category === 'all' ? categories : [category];
    const pageSize = category === 'all' ? 2 : Math.max(4, Math.floor(16 / catList.length));
    const results = await Promise.allSettled(catList.map(async (cat) => {
      const query = topicMap[cat] || cat;
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&pageSize=${pageSize}&language=en&sortBy=publishedAt&apiKey=${process.env.NEWSAPI_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === 'error') return [];
      return (data.articles || []).map((article, i) => ({ id: `${cat}-${i}`, title: article.title || 'Untitled', source: article.source?.name || 'Unknown', topic: cat, date: new Date(article.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), brief: (article.description || article.title || 'No description').replace(/\[\+\d+ chars\]$/, ''), url: article.url, imageUrl: article.urlToImage }));
    }));
    const all = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value);
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    const responseData = { articles: all.slice(0, 12), status: 'ok' };
    feedCache.set(cacheKey, { ts: Date.now(), data: responseData });
    if (category === 'all') simpleFeedCache = { data: responseData, timestamp: Date.now() };
    res.json(responseData);
  } catch (err) { res.json({ articles: [], status: 'error' }); }
});

module.exports = app;
