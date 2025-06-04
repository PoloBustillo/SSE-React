/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from "react";

const IncisoDisplay = () => {
  const [currentInciso, setCurrentInciso] = useState("");
  const [showInciso, setShowInciso] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Desconectado");
  const [eventSource, setEventSource] = useState(null);
  const [serverUrl, setServerUrl] = useState(
    "https://sse.psic-danieladiaz.com/events"
  );
  const [toasts, setToasts] = useState([]);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [maxReconnectAttempts] = useState(10);
  const [reconnectDelay, setReconnectDelay] = useState(1000);
  const [sendMessage, setSendMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendMode, setSendMode] = useState("dropdown"); // "dropdown" o "freetext"
  const [selectedNumber, setSelectedNumber] = useState("1");
  const [selectedLetter, setSelectedLetter] = useState("A");
  const [displayDuration, setDisplayDuration] = useState(5); // segundos

  const reconnectTimeoutRef = useRef(null);
  const incisoTimeoutRef = useRef(null);

  // Función para mostrar toast
  const showToast = (message, type = "error") => {
    const id = Date.now();
    const toast = { id, message, type };
    setToasts((prev) => [...prev, toast]);

    // Remover toast después de 5 segundos
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  // Función de reconexión automática
  const scheduleReconnect = () => {
    if (reconnectAttempts >= maxReconnectAttempts) {
      setConnectionStatus("Reconexión fallida - Máximo de intentos alcanzado");
      showToast("No se pudo reconectar después de múltiples intentos", "error");
      return;
    }

    // Limpiar timeout anterior si existe
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = Math.min(
      reconnectDelay * Math.pow(2, reconnectAttempts),
      30000
    ); // Exponential backoff, max 30s
    setConnectionStatus(
      `Reconectando en ${Math.ceil(delay / 1000)}s... (${
        reconnectAttempts + 1
      }/${maxReconnectAttempts})`
    );

    reconnectTimeoutRef.current = setTimeout(() => {
      setReconnectAttempts((prev) => prev + 1);
      connectToSSE();
    }, delay);
  };

  // Conectar a SSE con reconexión automática
  const connectToSSE = () => {
    if (eventSource) {
      eventSource.close();
    }

    // Limpiar timeout de reconexión si existe
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    try {
      setConnectionStatus("Conectando...");
      const newEventSource = new EventSource(serverUrl);

      newEventSource.onopen = () => {
        setIsConnected(true);
        setConnectionStatus("Conectado");
        setReconnectAttempts(0); // Reset contador de reconexión
        setReconnectDelay(1000); // Reset delay de reconexión
        console.log("Conectado a SSE");
        showToast("Conectado exitosamente", "success");
      };

      newEventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.inciso) {
            receiveInciso(data.inciso, data.duration);
          }
          if (data.message) {
            console.log("Mensaje del servidor:", data.message);
          }
        } catch (error) {
          console.error("Error al parsear datos SSE:", error);
        }
      };

      newEventSource.onerror = (error) => {
        console.error("Error SSE:", error);
        setIsConnected(false);

        // Solo intentar reconectar si no fue una desconexión manual
        if (newEventSource.readyState !== EventSource.CLOSED) {
          setConnectionStatus("Error de conexión - Reintentando...");
          scheduleReconnect();
        } else {
          setConnectionStatus("Desconectado");
        }
      };

      setEventSource(newEventSource);
    } catch (error) {
      setConnectionStatus("Error al conectar");
      console.error("Error al crear EventSource:", error);
      showToast(`Error al conectar: ${error.message}`, "error");
      scheduleReconnect();
    }
  };

  // Desconectar SSE
  const disconnectSSE = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (eventSource) {
      eventSource.close();
      setEventSource(null);
    }

    setIsConnected(false);
    setConnectionStatus("Desconectado");
    setReconnectAttempts(0);
    showToast("Desconectado manualmente", "success");
  };

  // Enviar mensaje a través de la API
  const sendMessageToServer = async () => {
    let messageToSend = "";

    if (sendMode === "dropdown") {
      messageToSend = `${selectedNumber} - ${selectedLetter}`;
    } else {
      messageToSend = sendMessage.trim();
      if (!messageToSend) {
        showToast("Por favor ingresa un mensaje", "error");
        return;
      }
    }

    setIsSending(true);
    try {
      const baseUrl = serverUrl.replace("/events", "");
      const response = await fetch(`${baseUrl}/send-inciso`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inciso: messageToSend,
          duration: displayDuration * 1000, // convertir a milisegundos
        }),
      });

      if (response.ok) {
        showToast(`Mensaje enviado: ${messageToSend}`, "success");
        if (sendMode === "freetext") {
          setSendMessage("");
        }
      } else {
        const errorData = await response.text();
        throw new Error(`Error ${response.status}: ${errorData}`);
      }
    } catch (error) {
      console.error("Error al enviar mensaje:", error);
      showToast(`Error al enviar: ${error.message}`, "error");
    } finally {
      setIsSending(false);
    }
  };

  // Auto-conectar al montar el componente
  useEffect(() => {
    connectToSSE();

    // Limpiar al desmontar componente
    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (incisoTimeoutRef.current) {
        clearTimeout(incisoTimeoutRef.current);
      }
    };
  }, []);

  // Limpiar al cambiar eventSource
  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [eventSource]);

  // Mostrar inciso recibido
  const receiveInciso = (inciso, duration) => {
    // Limpiar timeout anterior si existe
    if (incisoTimeoutRef.current) {
      clearTimeout(incisoTimeoutRef.current);
    }

    setCurrentInciso(inciso);
    setShowInciso(true);

    // Usar duración personalizada si se proporciona, sino usar la configurada
    // Siempre tomar el valor más reciente de displayDuration
    const timeoutDuration =
      typeof duration === "number" ? duration : displayDuration * 1000;

    // Desaparece después del tiempo configurado
    incisoTimeoutRef.current = setTimeout(() => {
      setShowInciso(false);
      setCurrentInciso("");
    }, timeoutDuration);
  };

  // Remover toast
  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="min-h-screen bg-black flex flex-col relative">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-white max-w-sm ${
              toast.type === "error" ? "bg-red-600" : "bg-green-600"
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="text-sm">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-2 text-white hover:text-gray-200"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pantalla principal para mostrar incisos */}
      <div className="flex-1 flex items-center justify-center">
        {showInciso ? (
          <div className="text-center">
            <div className="text-[#878686] text-[25rem] font-bold leading-none mb-8 drop-shadow-2xl">
              {currentInciso}
            </div>
          </div>
        ) : (
          // Pantalla completamente negra cuando no hay inciso
          <div className="w-full h-full bg-black">
            {/* Contenido invisible - solo para debugging si es necesario */}
          </div>
        )}
      </div>

      {/* Panel de configuración SSE - Solo visible cuando se hace hover */}
      <div className="bg-gray-800 p-4 border-t border-gray-700 transition-opacity duration-300 opacity-0 hover:opacity-100">
        <h2 className="text-white text-lg mb-3">
          Configuración Server-Sent Events
        </h2>

        {/* Configuración de conexión */}
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <div className="flex items-center gap-2">
            <label className="text-gray-300 text-sm">URL del servidor:</label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              className="bg-gray-700 text-white px-3 py-1 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
              placeholder="https://sse.psic-danieladiaz.com/events"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={connectToSSE}
              disabled={isConnected}
              className={`px-4 py-1 rounded text-sm font-medium transition-colors ${
                isConnected
                  ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700 text-white"
              }`}
            >
              Conectar
            </button>
            <button
              onClick={disconnectSSE}
              disabled={!isConnected}
              className={`px-4 py-1 rounded text-sm font-medium transition-colors ${
                !isConnected
                  ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }`}
            >
              Desconectar
            </button>
          </div>
        </div>

        {/* Estado de conexión */}
        <div className="flex items-center gap-2 mb-4">
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected ? "bg-green-500" : "bg-red-500"
            }`}
          ></div>
          <span className="text-gray-300 text-sm">
            Estado: {connectionStatus}
          </span>
          {reconnectAttempts > 0 && (
            <span className="text-yellow-400 text-xs">
              (Intento {reconnectAttempts}/{maxReconnectAttempts})
            </span>
          )}
        </div>

        {/* Panel para enviar mensajes */}
        <div className="border-t border-gray-700 pt-3">
          <h3 className="text-white text-md mb-3">Enviar Inciso</h3>

          {/* Configuración de tiempo de visualización */}
          <div className="mb-3 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-gray-300 text-sm">
                Tiempo de visualización:
              </label>
              <select
                value={displayDuration}
                onChange={(e) => setDisplayDuration(Number(e.target.value))}
                className="bg-gray-700 text-white px-2 py-1 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
              >
                <option value={1}>1 segundo</option>
                <option value={2}>2 segundos</option>
                <option value={3}>3 segundos</option>
                <option value={5}>5 segundos</option>
                <option value={10}>10 segundos</option>
                <option value={15}>15 segundos</option>
                <option value={20}>20 segundos</option>
                <option value={25}>25 segundos</option>
                <option value={30}>30 segundos</option>
              </select>
            </div>
          </div>

          {/* Selector de modo de entrada */}
          <div className="mb-3">
            <div className="flex gap-4 mb-2">
              <label className="flex items-center gap-2 text-gray-300 text-sm cursor-pointer">
                <input
                  type="radio"
                  value="dropdown"
                  checked={sendMode === "dropdown"}
                  onChange={(e) => setSendMode(e.target.value)}
                  className="text-blue-500"
                />
                Número - Letra
              </label>
              <label className="flex items-center gap-2 text-gray-300 text-sm cursor-pointer">
                <input
                  type="radio"
                  value="freetext"
                  checked={sendMode === "freetext"}
                  onChange={(e) => setSendMode(e.target.value)}
                  className="text-blue-500"
                />
                Texto libre
              </label>
            </div>
          </div>

          {/* Inputs según el modo seleccionado */}
          {sendMode === "dropdown" ? (
            <div className="flex gap-2 items-center mb-2">
              <select
                value={selectedNumber}
                onChange={(e) => setSelectedNumber(e.target.value)}
                className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                disabled={isSending}
              >
                {Array.from({ length: 50 }, (_, i) => i + 1).map((num) => (
                  <option key={num} value={num}>
                    {num}
                  </option>
                ))}
              </select>

              <span className="text-gray-300 text-lg font-bold">-</span>

              <select
                value={selectedLetter}
                onChange={(e) => setSelectedLetter(e.target.value)}
                className="bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                disabled={isSending}
              >
                {Array.from({ length: 26 }, (_, i) =>
                  String.fromCharCode(65 + i)
                ).map((letter) => (
                  <option key={letter} value={letter}>
                    {letter}
                  </option>
                ))}
              </select>

              <div className="flex-1 bg-gray-600 px-3 py-2 rounded text-gray-300 text-sm">
                Vista previa: {selectedNumber} - {selectedLetter}
              </div>

              <button
                onClick={sendMessageToServer}
                disabled={isSending}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  isSending
                    ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {isSending ? "Enviando..." : "Enviar"}
              </button>
            </div>
          ) : (
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={sendMessage}
                onChange={(e) => setSendMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendMessageToServer()}
                placeholder="Escribe el inciso a mostrar..."
                className="flex-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                disabled={isSending}
              />
              <button
                onClick={sendMessageToServer}
                disabled={isSending || !sendMessage.trim()}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  isSending || !sendMessage.trim()
                    ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {isSending ? "Enviando..." : "Enviar"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Información adicional */}
      <div className="bg-gray-800 p-3 transition-opacity duration-300 opacity-0 hover:opacity-100">
        <div className="text-center mb-2">
          <p className="text-gray-400 text-sm">
            Los incisos se muestran durante el tiempo configurado y luego
            desaparecen automáticamente
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Reconexión automática habilitada - La conexión se mantendrá siempre
            activa
          </p>
        </div>

        <div className="mt-3 text-xs text-gray-500">
          <details>
            <summary className="cursor-pointer hover:text-gray-400">
              Ver ejemplo de servidor Node.js actualizado
            </summary>
            <pre className="mt-2 bg-gray-900 p-3 rounded text-green-400 overflow-x-auto">
              {`// server.js - Servidor Node.js con reconexión y endpoint /send
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let clients = [];

// Endpoint SSE
app.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  // Agregar cliente a la lista
  clients.push(res);
  console.log(\`Cliente conectado. Total: \${clients.length}\`);
  
  // Enviar mensaje de bienvenida
  res.write('data: {"message": "Conectado exitosamente"}\\n\\n');
  
  // Mantener conexión viva
  const heartbeat = setInterval(() => {
    res.write('data: {"heartbeat": true}\\n\\n');
  }, 30000);
  
  req.on('close', () => {
    clearInterval(heartbeat);
    clients = clients.filter(client => client !== res);
    console.log(\`Cliente desconectado. Total: \${clients.length}\`);
  });
});

// Endpoint para enviar incisos
app.post('/send-inciso', (req, res) => {
  const { inciso, duration } = req.body;
  
  if (!inciso) {
    return res.status(400).json({ error: 'Inciso requerido' });
  }
  
  console.log(\`Enviando inciso: \${inciso} (duración: \${duration || 30000}ms) a \${clients.length} clientes\`);
  
  // Enviar a todos los clientes conectados
  clients.forEach(client => {
    try {
      client.write(\`data: \${JSON.stringify({ inciso, duration })}\\n\\n\`);
    } catch (error) {
      console.error('Error enviando a cliente:', error);
    }
  });
  
  res.json({ 
    success: true, 
    message: \`Inciso enviado a \${clients.length} clientes\`,
    inciso,
    duration: duration || 30000
  });
});

app.listen(3001, () => {
  console.log('Servidor SSE en puerto 3001');
  console.log('Endpoints disponibles:');
  console.log('- GET /events (SSE)');
  console.log('- POST /send-inciso (Enviar incisos)');
});`}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
};

export default IncisoDisplay;
