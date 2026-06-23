// api/generate.js
// Funcion serverless para Vercel (Node 18+). Genera 10 ideas de
// contenido con Google Gemini (capa GRATUITA), a partir de las
// respuestas del usuario y en la voz de marca de Marta Valiente.
//
// Requiere la variable de entorno GEMINI_API_KEY (se configura en Vercel).
// Opcional: GEMINI_MODEL (por defecto gemini-2.0-flash).

var SYSTEM_PROMPT = [
  "Eres el asistente creativo de Marta Valiente, una herramienta que se llama \"Erase una idea\".",
  "Marta es Social Media Manager, copywriter estrategica y especialista en marketing y storytelling. Comunica desde lo autentico y acompana a marcas y proyectos a crear su historia, sin ruido y con intencion.",
  "",
  "TU FILOSOFIA (innegociable):",
  "- No 'generas' ideas de la nada: ayudas a la persona a VER las historias e ideas que ya tiene en su experiencia real y cotidiana, sobre todo en lo que escuchan de sus clientes.",
  "- Marketing autentico por encima de la tactica. Conectar antes que vender.",
  "- No hay formula cerrada ni metodo con nombre propio: se trata de escuchar, observar y entender que quiere decir cada proyecto.",
  "",
  "TONO DE VOZ (imitalo con fidelidad, suena a Marta, NUNCA a IA generica):",
  "- Cercano, de tu a tu, calido, intimo y reflexivo. Con calma.",
  "- Frases MUY cortas, una idea por linea.",
  "- Cero jerga de growth marketing. Prohibido: 'hackea', 'x10', 'viral garantizado', 'domina el algoritmo', urgencia falsa, lenguaje robotico o de manual.",
  "- Los hooks invitan a mirar hacia dentro. Los CTA son preguntas abiertas que invitan a conversar, no a comprar de forma agresiva.",
  "- Consejos de profesional con criterio, no obviedades.",
  "",
  "EJEMPLOS DE SU CADENCIA (referencia de estilo, no copiar literal):",
  "\"Muchas veces no hacemos lo que queremos. Hacemos lo que creemos que deberiamos hacer.\"",
  "\"Publicar mucho no es comunicar. A veces es solo ruido.\"",
  "\"Con calma. Con intencion. Y siendo fiel a lo que hay detras.\"",
  "",
  "TAREA:",
  "A partir de las respuestas de la persona, devuelve EXACTAMENTE 10 ideas de contenido PERSONALIZADAS y especificas para SU caso (su sector, su semana, sus retos y, sobre todo, lo que le preguntan o cuentan sus clientes). Nada generico: cada idea debe sentirse hecha a medida y resolver algo concreto de esa persona.",
  "",
  "Cada idea debe tener:",
  "- titulo: titulo concreto y evocador de la idea de contenido.",
  "- objetivo: 1-2 palabras (ej: Conexion, Confianza, Autoridad, Ventas, Comunidad, Posicionamiento).",
  "- enfoques: array de 2-3 angulos distintos para abordarla.",
  "- formatos: array de 2-3 formatos (ej: Post de texto, Carrusel, Reel a camara, Video corto).",
  "- hook: array de 2-3 lineas cortas (cada elemento es una linea), en la voz de Marta.",
  "- cta: una llamada a la accion suave, normalmente en forma de pregunta.",
  "",
  "FORMATO DE SALIDA: devuelve SOLO un objeto JSON valido, sin texto adicional, con esta forma:",
  "{ \"ideas\": [ { \"titulo\": \"\", \"objetivo\": \"\", \"enfoques\": [], \"formatos\": [], \"hook\": [], \"cta\": \"\" } ] }",
  "Responde siempre en espanol."
].join("
");

function construirPromptUsuario(r) {
  r = r || {};
  function campo(etq, val) {
    var v = (val != null && String(val).trim()) ? String(val).trim() : "(sin respuesta)";
    return etq + ": " + v;
  }
  return [
    "Estas son las respuestas de la persona. Usalas para personalizar al maximo las 10 ideas:",
    "",
    campo("A que se dedica", r.dedicas),
    campo("Que quiere conseguir", r.objetivo),
    campo("En que punto esta", r.momento),
    campo("Que le ha pasado esta semana", r.semana),
    campo("Que le preguntan sus clientes / que le apasiona", r.extra)
  ].join("
");
}

function normalizarIdeas(ideas) {
  if (!Array.isArray(ideas)) return [];
  return ideas.slice(0, 10).map(function (idea) {
    idea = idea || {};
    var hook = idea.hook;
    if (typeof hook === "string") {
      hook = hook.split(/
|\. /).map(function (s) { return s.trim(); }).filter(Boolean);
    }
    if (!Array.isArray(hook)) hook = [];
    return {
      titulo: idea.titulo || "",
      objetivo: idea.objetivo || "",
      enfoques: Array.isArray(idea.enfoques) ? idea.enfoques : [],
      formatos: Array.isArray(idea.formatos) ? idea.formatos : [],
      hook: hook,
      cta: idea.cta || ""
    };
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo no permitido" });
    return;
  }

  var apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "GEMINI_API_KEY no configurada" });
    return;
  }

  try {
    var body = req.body;
    if (typeof body === "string") { body = JSON.parse(body || "{}"); }
    if (!body || typeof body !== "object") { body = {}; }
    var respuestas = body.respuestas || {};
    var model = process.env.GEMINI_MODEL || "gemini-2.0-flash";

    var url = "https://generativelanguage.googleapis.com/v1beta/models/" +
      model + ":generateContent?key=" + encodeURIComponent(apiKey);

    var geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: construirPromptUsuario(respuestas) }] }],
        generationConfig: {
          temperature: 0.9,
          response_mime_type: "application/json"
        }
      })
    });

    if (!geminiRes.ok) {
      var detalle = await geminiRes.text();
      console.error("Gemini error:", geminiRes.status, detalle);
      res.status(502).json({ error: "Error al llamar a Gemini" });
      return;
    }

    var data = await geminiRes.json();
    var contenido = "{}";
    if (data.candidates && data.candidates[0] && data.candidates[0].content &&
        data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
      contenido = data.candidates[0].content.parts[0].text || "{}";
    }

    var parsed;
    try { parsed = JSON.parse(contenido); }
    catch (e) { res.status(502).json({ error: "Respuesta de IA no valida" }); return; }

    var ideas = normalizarIdeas(parsed.ideas);
    if (ideas.length === 0) {
      res.status(502).json({ error: "Sin ideas en la respuesta" });
      return;
    }

    if (body.email) { console.log("Nuevo lead:", body.email); }

    res.status(200).json({ ideas: ideas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error inesperado" });
  }
};
