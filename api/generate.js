// api/generate.js
// Funcion serverless para Vercel (Node 18+). Genera 10 ideas de
// contenido con Groq (IA gratuita), en la voz de marca de Marta Valiente.
//
// Requiere la variable de entorno GROQ_API_KEY (se configura en Vercel).
// Opcional: GROQ_MODEL (por defecto llama-3.3-70b-versatile).
//
// Truco: abrir esta ruta en el navegador (GET) hace un diagnostico
// y muestra si la clave y el modelo funcionan.

var NL = String.fromCharCode(10);

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
  "- Los hooks invitan a mirar hacia dentro. Los CTA son preguntas abiertas que invitan a conversar.",
  "- Consejos de profesional con criterio, no obviedades.",
  "",
  "TAREA:",
  "A partir de las respuestas de la persona, devuelve EXACTAMENTE 10 ideas de contenido PERSONALIZADAS y especificas para SU caso (su sector, su semana, sus retos y, sobre todo, lo que le preguntan o cuentan sus clientes). Nada generico.",
  "",
  "Cada idea debe tener:",
  "- titulo: titulo concreto y evocador.",
  "- objetivo: 1-2 palabras (ej: Conexion, Confianza, Autoridad, Ventas, Comunidad, Posicionamiento).",
  "- enfoques: array de 2-3 angulos distintos.",
  "- formatos: array de 2-3 formatos (ej: Post de texto, Carrusel, Reel a camara, Video corto).",
  "- hook: array de 2-3 lineas cortas, en la voz de Marta.",
  "- cta: llamada a la accion suave, normalmente en forma de pregunta.",
  "",
  "FORMATO DE SALIDA: devuelve SOLO un objeto JSON valido, sin texto adicional, con esta forma:",
  "{ \"ideas\": [ { \"titulo\": \"\", \"objetivo\": \"\", \"enfoques\": [], \"formatos\": [], \"hook\": [], \"cta\": \"\" } ] }",
  "Responde siempre en espanol."
].join(NL);

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
  ].join(NL);
}

function normalizarIdeas(ideas) {
  if (!Array.isArray(ideas)) return [];
  return ideas.slice(0, 10).map(function (idea) {
    idea = idea || {};
    var hook = idea.hook;
    if (typeof hook === "string") { hook = [hook]; }
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

function llamarGroq(apiKey, model, messages, jsonMode) {
  var cuerpo = {
    model: model,
    temperature: 0.9,
    messages: messages
  };
  if (jsonMode) { cuerpo.response_format = { type: "json_object" }; }
  return fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey
    },
    body: JSON.stringify(cuerpo)
  });
}

module.exports = async function handler(req, res) {
  var apiKey = process.env.GROQ_API_KEY || "";
  var model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  // ---- Diagnostico al abrir en el navegador (GET) ----
  if (req.method === "GET") {
    var info = { clavePresente: apiKey.length > 0, claveEmpiezaPor: apiKey.slice(0, 4), modelo: model };
    if (!apiKey) { res.status(200).json(Object.assign(info, { aviso: "No hay GROQ_API_KEY en este despliegue" })); return; }
    try {
      var rDiag = await llamarGroq(apiKey, model, [{ role: "user", content: "Di hola en una sola palabra." }], false);
      var tDiag = await rDiag.text();
      info.statusDeGroq = rDiag.status;
      info.respuestaDeGroq = tDiag.slice(0, 800);
      res.status(200).json(info);
    } catch (e) {
      info.errorJS = String(e);
      res.status(200).json(info);
    }
    return;
  }

  if (req.method !== "POST") { res.status(405).json({ error: "Metodo no permitido" }); return; }

  if (!apiKey) { res.status(503).json({ error: "GROQ_API_KEY no configurada" }); return; }

  try {
    var body = req.body;
    if (typeof body === "string") { body = JSON.parse(body || "{}"); }
    if (!body || typeof body !== "object") { body = {}; }
    var respuestas = body.respuestas || {};

    var groqRes = await llamarGroq(apiKey, model, [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: construirPromptUsuario(respuestas) }
    ], true);

    if (!groqRes.ok) {
      var detalle = await groqRes.text();
      console.error("Groq error:", groqRes.status, detalle);
      res.status(502).json({ error: "Error al llamar a Groq" });
      return;
    }

    var data = await groqRes.json();
    var contenido = (data.choices && data.choices[0] && data.choices[0].message)
      ? data.choices[0].message.content
      : "{}";

    var parsed;
    try { parsed = JSON.parse(contenido); }
    catch (e) { res.status(502).json({ error: "Respuesta de IA no valida" }); return; }

    var ideas = normalizarIdeas(parsed.ideas);
    if (ideas.length === 0) { res.status(502).json({ error: "Sin ideas en la respuesta" }); return; }

    if (body.email) { console.log("Nuevo lead:", body.email); }

    res.status(200).json({ ideas: ideas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error inesperado" });
  }
};
