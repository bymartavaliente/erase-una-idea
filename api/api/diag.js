// api/diag.js
// Archivo TEMPORAL de diagnostico. Llama a Gemini con una prueba minima
// y devuelve el resultado en pantalla para ver el error real.
// Cuando todo funcione, se puede borrar.

module.exports = async function handler(req, res) {
  var apiKey = process.env.GEMINI_API_KEY || "";
  var model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  var info = {
    clavePresente: apiKey.length > 0,
    claveEmpiezaPor: apiKey.slice(0, 4),
    modelo: model
  };

  if (!apiKey) {
    res.status(200).json(Object.assign(info, { aviso: "No hay GEMINI_API_KEY en este despliegue" }));
    return;
  }

  try {
    var url = "https://generativelanguage.googleapis.com/v1beta/models/" +
      model + ":generateContent?key=" + encodeURIComponent(apiKey);
    var r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Di hola en una sola palabra." }] }] })
    });
    var texto = await r.text();
    info.statusDeGemini = r.status;
    info.respuestaDeGemini = texto.slice(0, 900);
    res.status(200).json(info);
  } catch (e) {
    info.errorJS = String(e);
    res.status(200).json(info);
  }
};
