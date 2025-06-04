/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from "react";

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

  // Conectar a SSE
  const connectToSSE = () => {
    if (eventSource) {
      eventSource.close();
    }

    try {
      const newEventSource = new EventSource(serverUrl);

      newEventSource.onopen = () => {
        setIsConnected(true);
        setConnectionStatus("Conectado");
        console.log("Conectado a SSE");
      };

      newEventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.inciso) {
            receiveInciso(data.inciso);
          }
        } catch (error) {
          console.error("Error al parsear datos SSE:", error);
        }
      };

      newEventSource.onerror = (error) => {
        setIsConnected(false);
        setConnectionStatus("Error de conexión");
        console.error("Error SSE:", error);
        showToast(
          `Error de conexión SSE: ${error.message || "Conexión fallida"}`
        );
      };

      setEventSource(newEventSource);
    } catch (error) {
      setConnectionStatus("Error al conectar");
      console.error("Error al crear EventSource:", error);
      showToast(`Error al conectar: ${error.message}`);
    }
  };

  // Desconectar SSE
  const disconnectSSE = () => {
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
      setIsConnected(false);
      setConnectionStatus("Desconectado");
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
  const receiveInciso = (inciso) => {
    setCurrentInciso(inciso);
    setShowInciso(true);

    // Desaparece después de 30 segundos
    setTimeout(() => {
      setShowInciso(false);
      setCurrentInciso("");
    }, 30000);
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
          <div className="text-center animate-pulse">
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

      {/* Panel de configuración SSE - Solo visible cuando hay inciso o se hace hover */}
      <div
        className={
          "bg-gray-800 p-4 border-t border-gray-700 transition-opacity duration-300 opacity-0 hover:opacity-100"
        }
      >
        <h2 className="text-white text-lg mb-3">
          Configuración Server-Sent Events
        </h2>
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <div className="flex items-center gap-2">
            <label className="text-gray-300 text-sm">URL del servidor:</label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              className="bg-gray-700 text-white px-3 py-1 rounded border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
              placeholder="http://localhost:3001/events"
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
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected ? "bg-green-500" : "bg-red-500"
            }`}
          ></div>
          <span className="text-gray-300 text-sm">
            Estado: {connectionStatus}
          </span>
        </div>
      </div>

      {/* Información adicional */}
      <div
        className={
          "bg-gray-800 p-3 transition-opacity duration-300 opacity-0 hover:opacity-100"
        }
      >
        <div className="text-center mb-2">
          <p className="text-gray-400 text-sm">
            Los incisos se muestran durante 30 segundos y luego desaparecen
            automáticamente
          </p>
        </div>

        <div className="mt-3 text-xs text-gray-500">
          <details>
            <summary className="cursor-pointer hover:text-gray-400">
              Ver ejemplo de servidor Node.js
            </summary>
            <pre className="mt-2 bg-gray-900 p-3 rounded text-green-400 overflow-x-auto">
              {`// server.js - Servidor Node.js de ejemplo
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Endpoint SSE
app.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  res.write('data: {"message": "Conectado"}\\n\\n');
  
  req.on('close', () => {
    console.log('Cliente desconectado');
  });
});

// Endpoint para enviar incisos
app.post('/send-inciso', (req, res) => {
  const { inciso } = req.body;
  // Aquí enviarías a todos los clientes conectados
  res.json({ success: true });
});

app.listen(3001, () => {
  console.log('Servidor SSE en puerto 3001');
});`}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
};

export default IncisoDisplay;
