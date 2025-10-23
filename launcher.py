import tkinter as tk
from tkinter import ttk, messagebox
import subprocess
import threading
import os
import sys
from datetime import datetime
import webbrowser

class ThermalPrinterLauncher:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title(" Thermal Printer Server - La Casita")
        self.root.geometry("550x650")
        self.root.resizable(True, True)
        self.root.minsize(500, 600)
        
        # Variables
        self.server_process = None
        self.is_running = False
        self.start_time = None
        self.ngrok_url = None
        self.use_docker = False
        self.monitor_thread = None
        self.last_health_check = None
        
        # Colores modernos
        self.colors = {
            'bg': '#f0f2f5',
            'primary': '#1976d2',
            'success': '#4caf50',
            'danger': '#f44336',
            'warning': '#ff9800',
            'dark': '#333333',
            'light': '#ffffff',
            'secondary': '#6c757d'
        }
        
        self.setup_ui()
        
        # Cambiar al directorio del script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        os.chdir(script_dir)
        
        self.update_clock()
        
    def setup_ui(self):
        self.root.configure(bg=self.colors['bg'])
        
        # Marco principal
        main_frame = tk.Frame(self.root, bg=self.colors['bg'])
        main_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=15)
        
        # Header
        header_frame = tk.Frame(main_frame, bg=self.colors['bg'])
        header_frame.pack(fill=tk.X, pady=(0, 20))
        
        title_label = tk.Label(header_frame, text=" Thermal Printer Server", 
                              font=("Segoe UI", 20, "bold"),
                              fg=self.colors['primary'], bg=self.colors['bg'])
        title_label.pack()
        
        subtitle_label = tk.Label(header_frame, text="Sistema de Impresión Térmica - La Casita", 
                                 font=("Segoe UI", 11),
                                 fg=self.colors['secondary'], bg=self.colors['bg'])
        subtitle_label.pack(pady=(5, 0))
        
        self.clock_label = tk.Label(header_frame, text="", 
                                   font=("Segoe UI", 10),
                                   fg=self.colors['dark'], bg=self.colors['bg'])
        self.clock_label.pack(pady=(5, 0))
        
        # Tarjeta de estado
        status_card = tk.Frame(main_frame, bg=self.colors['light'], relief=tk.RAISED, bd=1)
        status_card.pack(fill=tk.X, pady=(0, 15), ipady=15)
        
        self.status_label = tk.Label(status_card, text="🔴 Estado: Detenido", 
                                    font=("Segoe UI", 14, "bold"), fg=self.colors['danger'], 
                                    bg=self.colors['light'])
        self.status_label.pack(pady=5)
        
        self.uptime_label = tk.Label(status_card, text="Tiempo activo: --", 
                                    font=("Segoe UI", 10), fg=self.colors['secondary'], 
                                    bg=self.colors['light'])
        self.uptime_label.pack()
        
        # Panel de configuración
        info_frame = tk.Frame(main_frame, bg=self.colors['light'], relief=tk.RAISED, bd=1)
        info_frame.pack(fill=tk.X, pady=(0, 15), ipady=10)
        
        tk.Label(info_frame, text=" Configuración del Servidor", 
                font=("Segoe UI", 12, "bold"), fg=self.colors['dark'], 
                bg=self.colors['light']).pack(pady=(5, 10))
        
        # Leer configuración del .env si existe
        self.config = self.load_env_config()

        info_items = [
            (" Modo:", self.config.get('mode', 'HTTP + ngrok')),
            (" Impresora IP:", f"{self.config.get('printer_ip', '192.168.1.200')}:{self.config.get('printer_port', '9100')}"),
            ("🔐 ngrok:", "Configurado ✓" if self.config.get('has_ngrok_token') else "No configurado"),
            (" CORS Origin:", "la-casita.vercel.app")
        ]
        
        for label, value in info_items:
            row = tk.Frame(info_frame, bg=self.colors['light'])
            row.pack(fill=tk.X, pady=2)
            tk.Label(row, text=label, font=("Segoe UI", 9, "bold"), 
                    fg=self.colors['dark'], bg=self.colors['light']).pack(side=tk.LEFT, padx=(20, 0))
            tk.Label(row, text=value, font=("Segoe UI", 9), 
                    fg=self.colors['primary'], bg=self.colors['light']).pack(side=tk.LEFT, padx=(10, 0))
        
        # Botones principales
        control_frame = tk.Frame(main_frame, bg=self.colors['bg'])
        control_frame.pack(fill=tk.X, pady=(0, 15))
        
        buttons_frame = tk.Frame(control_frame, bg=self.colors['bg'])
        buttons_frame.pack()
        
        self.start_button = tk.Button(buttons_frame, text="▶️ INICIAR SERVIDOR", 
                                     command=self.start_server, 
                                     font=("Segoe UI", 11, "bold"), 
                                     bg=self.colors['success'], fg="white",
                                     width=18, height=2, bd=0, cursor="hand2")
        self.start_button.pack(side=tk.LEFT, padx=5)
        
        
        self.stop_button = tk.Button(buttons_frame, text="⏹️ DETENER SERVIDOR", 
                                    command=self.stop_server, 
                                    font=("Segoe UI", 11, "bold"), 
                                    bg=self.colors['danger'], fg="white",
                                    width=18, height=2, bd=0, cursor="hand2",
                                    state=tk.DISABLED)
        self.stop_button.pack(side=tk.LEFT, padx=5)
        
        # Botones secundarios
        secondary_buttons = tk.Frame(control_frame, bg=self.colors['bg'])
        secondary_buttons.pack(pady=(10, 0))
        
        
        self.app_button = tk.Button(secondary_buttons, text=" Abrir La Casita", 
                                   command=self.open_app,
                                   font=("Segoe UI", 10), 
                                   bg=self.colors['primary'], fg="white",
                                   width=15, height=1, bd=0, cursor="hand2")
        self.app_button.pack(side=tk.LEFT, padx=5)
        
        self.check_button = tk.Button(secondary_buttons, text=" Verificar Servidor",
                                     command=self.check_server,
                                     font=("Segoe UI", 10),
                                     bg=self.colors['secondary'], fg="white",
                                     width=15, height=1, bd=0, cursor="hand2")
        self.check_button.pack(side=tk.LEFT, padx=5)

        self.logs_button = tk.Button(secondary_buttons, text=" Ver Logs",
                                     command=self.view_logs,
                                     font=("Segoe UI", 10),
                                     bg=self.colors['warning'], fg="white",
                                     width=12, height=1, bd=0, cursor="hand2")
        self.logs_button.pack(side=tk.LEFT, padx=5)
        
        # Panel de logs
        log_card = tk.Frame(main_frame, bg=self.colors['light'], relief=tk.RAISED, bd=1)
        log_card.pack(fill=tk.BOTH, expand=True)
        
        log_header = tk.Frame(log_card, bg=self.colors['light'])
        log_header.pack(fill=tk.X, padx=10, pady=(10, 5))
        
        tk.Label(log_header, text=" Registro de Actividad", 
                font=("Segoe UI", 12, "bold"), fg=self.colors['dark'], 
                bg=self.colors['light']).pack(side=tk.LEFT)
        
        clear_button = tk.Button(log_header, text="🧹 Limpiar", 
                               command=self.clear_logs,
                               font=("Segoe UI", 8), 
                               bg=self.colors['secondary'], fg="white",
                               width=8, height=1, bd=0, cursor="hand2")
        clear_button.pack(side=tk.RIGHT)
        
        log_frame = tk.Frame(log_card, bg=self.colors['light'])
        log_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=(0, 10))
        
        self.log_text = tk.Text(log_frame, height=12, font=("Consolas", 9),
                               bg="#f8f9fa", fg=self.colors['dark'],
                               bd=0, wrap=tk.WORD, padx=10, pady=10)
        scrollbar = tk.Scrollbar(log_frame, orient=tk.VERTICAL, command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=scrollbar.set)
        
        self.log_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # Mensaje de bienvenida
        welcome_msg = f"🎉 Bienvenido al Sistema de Impresión Térmica\n"
        welcome_msg += f"📅 Fecha: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n"
        welcome_msg += f" Presiona 'INICIAR SERVIDOR' para comenzar\n"
        welcome_msg += f"{'='*50}\n"
        self.log_message(welcome_msg)
        
    def load_env_config(self):
        """Cargar configuración del archivo .env"""
        config = {
            'mode': 'HTTP + ngrok',
            'printer_ip': '192.168.1.200',
            'printer_port': '9100',
            'has_ngrok_token': False
        }

        try:
            if os.path.exists('.env'):
                with open('.env', 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if '=' in line and not line.startswith('#'):
                            key, value = line.split('=', 1)
                            key = key.strip()
                            value = value.strip()

                            if key == 'PRINTER_IP':
                                config['printer_ip'] = value
                            elif key == 'PRINTER_PORT':
                                config['printer_port'] = value
                            elif key == 'NGROK_AUTHTOKEN' and value and value != 'tu_authtoken_aqui':
                                config['has_ngrok_token'] = True
        except Exception as e:
            print(f"Error loading .env: {e}")

        return config

    def update_clock(self):
        """Actualizar el reloj cada segundo"""
        now = datetime.now()
        time_str = f"{now.strftime('%d/%m/%Y - %H:%M:%S')}"
        self.clock_label.config(text=time_str)
        
        # Actualizar tiempo activo si el servidor está corriendo
        if self.is_running and self.start_time:
            uptime = datetime.now() - self.start_time
            hours = uptime.seconds // 3600
            minutes = (uptime.seconds % 3600) // 60
            seconds = uptime.seconds % 60
            uptime_str = f"Tiempo activo: {hours:02d}:{minutes:02d}:{seconds:02d}"
            self.uptime_label.config(text=uptime_str)
        
        self.root.after(1000, self.update_clock)
        
    def log_message(self, message):
        """Agregar mensaje al log con timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.log_text.insert(tk.END, f"[{timestamp}] {message}\n")
        self.log_text.see(tk.END)
        self.root.update()
        
    def clear_logs(self):
        """Limpiar el área de logs"""
        self.log_text.delete(1.0, tk.END)
        self.log_message("🧹 Logs limpiados")
        
    def start_server(self):
        """Iniciar el servidor"""
        try:
            self.log_message(" Iniciando servidor...")
            self.start_time = datetime.now()
            self.ngrok_url = None

            def run_server():
                try:
                    # Verificar si existe imagen Docker
                    check_image = subprocess.run(
                        ["docker", "images", "-q", "thermal-printer-server"],
                        capture_output=True, text=True,
                        creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
                    )

                    if check_image.stdout.strip():
                        # Usar Docker si la imagen existe
                        self.use_docker = True
                        self.root.after(0, lambda: self.log_message("🐳 Iniciando con Docker..."))
                        self.server_process = subprocess.Popen(
                            "docker run --env-file .env -p 3001:3001 --name thermal-printer --rm thermal-printer-server",
                            stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT,
                            universal_newlines=True,
                            shell=True,
                            encoding='utf-8',
                            errors='replace',
                            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
                        )
                    else:
                        # Fallback a npm run ngrok si no hay imagen Docker
                        self.use_docker = False
                        has_ngrok = self.config.get('has_ngrok_token', False)

                        if has_ngrok:
                            self.root.after(0, lambda: self.log_message(" Iniciando con ngrok..."))
                            cmd = "npm run ngrok"
                        else:
                            self.root.after(0, lambda: self.log_message(" ngrok no configurado, iniciando servidor local"))
                            cmd = "npm start"

                        self.server_process = subprocess.Popen(
                            cmd,
                            stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT,
                            universal_newlines=True,
                            shell=True,
                            encoding='utf-8',
                            errors='replace',
                            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
                        )

                    # Leer salida del proceso
                    for line in iter(self.server_process.stdout.readline, ''):
                        if line:
                            line_stripped = line.strip()

                            # Detectar URL de ngrok
                            if 'URL Pública:' in line_stripped or 'ngrok-free.app' in line_stripped or 'ngrok.app' in line_stripped:
                                # Extraer URL
                                import re
                                url_match = re.search(r'https://[a-zA-Z0-9-]+\.ngrok[a-z-]*\.[a-z]+', line_stripped)
                                if url_match:
                                    self.ngrok_url = url_match.group(0)
                                    self.root.after(0, lambda u=self.ngrok_url: self.show_ngrok_url(u))

                            self.root.after(0, lambda l=line_stripped: self.log_message(f" {l}"))

                        if self.server_process.poll() is not None:
                            break

                    # Si el proceso terminó, notificar
                    if self.server_process.poll() is not None:
                        exit_code = self.server_process.poll()
                        self.root.after(0, lambda code=exit_code: self.log_message(f" Proceso del servidor terminó con código: {code}"))
                        self.root.after(0, lambda: self.on_server_died())

                except Exception as e:
                    self.root.after(0, lambda e=e: self.log_message(f" Error: {str(e)}"))

            server_thread = threading.Thread(target=run_server, daemon=True)
            server_thread.start()

            # Iniciar monitor de salud del servidor
            self.start_health_monitor()

            # Actualizar UI
            self.is_running = True
            self.status_label.config(text="🟢 Estado: Ejecutándose", fg=self.colors['success'])
            self.start_button.config(state=tk.DISABLED)
            self.stop_button.config(state=tk.NORMAL)

            self.log_message(" Servidor iniciado correctamente")
            if not self.config.get('has_ngrok_token'):
                self.log_message(" Servidor local en: http://localhost:3001")
            else:
                self.log_message("⏳ Esperando URL pública de ngrok...")

        except Exception as e:
            messagebox.showerror("Error", f"No se pudo iniciar el servidor:\n{str(e)}")
            self.log_message(f" Error al iniciar: {str(e)}")

    def show_ngrok_url(self, url):
        """Mostrar URL de ngrok en un popup simple"""
        self.log_message(f" Servidor listo: {url}")
        # No mostrar popup, solo en logs es suficiente

    def start_health_monitor(self):
        """Iniciar monitor de salud del servidor"""
        def monitor():
            import urllib.request
            import ssl
            import time

            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE

            consecutive_failures = 0
            max_failures = 3

            while self.is_running:
                try:
                    time.sleep(30)  # Verificar cada 30 segundos

                    if not self.is_running:
                        break

                    # Intentar ping al servidor
                    try:
                        with urllib.request.urlopen("http://localhost:3001/test", context=ctx, timeout=5) as response:
                            if response.getcode() == 200:
                                consecutive_failures = 0
                                continue
                    except Exception:
                        consecutive_failures += 1

                    # Si falla múltiples veces consecutivas, alertar
                    if consecutive_failures >= max_failures:
                        self.root.after(0, lambda: self.log_message(
                            f" ADVERTENCIA: Servidor no responde después de {max_failures} intentos"
                        ))
                        consecutive_failures = 0  # Reset para no spamear

                except Exception:
                    pass

        self.monitor_thread = threading.Thread(target=monitor, daemon=True)
        self.monitor_thread.start()

    def on_server_died(self):
        """Manejar cuando el servidor muere inesperadamente"""
        if self.is_running:
            self.log_message(" ¡ALERTA! El servidor se cerró inesperadamente")
            self.log_message(" Revisa los logs arriba para ver el error")

            # Actualizar UI
            self.is_running = False
            self.status_label.config(text="🔴 Estado: Detenido (crash)", fg=self.colors['danger'])
            self.uptime_label.config(text="Tiempo activo: --")
            self.start_button.config(state=tk.NORMAL)
            self.stop_button.config(state=tk.DISABLED)
    
    
    def stop_server(self):
        """Detener el servidor"""
        try:
            if self.server_process:
                self.log_message(" Deteniendo servidor...")

                # Detener contenedor Docker si existe
                try:
                    subprocess.run(["docker", "stop", "thermal-printer"],
                                 creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
                                 timeout=10,
                                 capture_output=True)
                    self.log_message("🐳 Contenedor Docker detenido")
                except:
                    pass

                # Matar el proceso y todos sus hijos
                if sys.platform == "win32":
                    # En Windows, usar taskkill para matar el árbol de procesos
                    try:
                        subprocess.run(
                            ["taskkill", "/F", "/T", "/PID", str(self.server_process.pid)],
                            creationflags=subprocess.CREATE_NO_WINDOW,
                            capture_output=True,
                            timeout=5
                        )
                        self.log_message("🔪 Procesos detenidos (npm, node, ngrok)")
                    except Exception as e:
                        self.log_message(f" Error al detener procesos: {str(e)}")
                else:
                    # En Linux/Mac, usar terminate normal
                    self.server_process.terminate()

                self.server_process = None

            self.is_running = False
            self.start_time = None
            self.ngrok_url = None
            self.status_label.config(text="🔴 Estado: Detenido", fg=self.colors['danger'])
            self.uptime_label.config(text="Tiempo activo: --")
            self.start_button.config(state=tk.NORMAL)
            self.stop_button.config(state=tk.DISABLED)

            self.log_message(" Servidor detenido correctamente")

        except Exception as e:
            messagebox.showerror("Error", f"Error al detener el servidor:\n{str(e)}")
    
    
    def open_app(self):
        """Abrir la aplicación La Casita"""
        self.log_message(" Abriendo La Casita...")
        try:
            webbrowser.open("https://la-casita.vercel.app/")
            self.log_message(" La Casita abierta en el navegador")
        except Exception as e:
            self.log_message(f" Error al abrir La Casita: {str(e)}")
    
    def check_server(self):
        """Verificar si el servidor está respondiendo y obtener estadísticas"""
        self.log_message(" Verificando estado del servidor...")

        def check():
            import urllib.request
            import ssl
            import json

            # Crear contexto SSL que ignore certificados
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE

            # Primero intentar /health para obtener estadísticas completas
            health_urls = [
                "http://localhost:3001/health",
                "http://127.0.0.1:3001/health"
            ]

            # Si hay URL de ngrok, probarla también
            if self.ngrok_url:
                health_urls.insert(0, f"{self.ngrok_url}/health")

            for url in health_urls:
                try:
                    with urllib.request.urlopen(url, context=ctx, timeout=5) as response:
                        if response.getcode() == 200:
                            data = json.loads(response.read().decode())
                            self.last_health_check = data

                            # Logs detallados
                            self.root.after(0, lambda u=url: self.log_message(f" Servidor respondiendo en: {u}"))
                            self.root.after(0, lambda: self.log_message(f"  Uptime: {data.get('uptime', 'N/A')}"))

                            stats = data.get('stats', {})
                            self.root.after(0, lambda: self.log_message(
                                f" Stats: {stats.get('successfulPrints', 0)} / {stats.get('failedPrints', 0)} " +
                                f"(Tasa: {stats.get('successRate', 'N/A')})"
                            ))

                            # Mostrar uso de memoria
                            memory = data.get('server', {}).get('memory', {})
                            if memory:
                                self.root.after(0, lambda: self.log_message(
                                    f"💾 Memoria: RSS={memory.get('rss', 'N/A')}, Heap={memory.get('heapUsed', 'N/A')}"
                                ))

                            # Mostrar último error si existe
                            last_error = stats.get('lastError')
                            if last_error:
                                self.root.after(0, lambda err=last_error: self.log_message(
                                    f"  Último error: Mesa {err.get('mesa', '?')} - {err.get('error', 'Desconocido')}"
                                ))

                            return
                except Exception as e:
                    self.root.after(0, lambda u=url, err=str(e): self.log_message(f" {u}: {err}"))

            self.root.after(0, lambda: self.log_message(" Servidor no responde en ninguna URL"))

        threading.Thread(target=check, daemon=True).start()

    def view_logs(self):
        """Abrir ventana para ver logs del servidor"""
        self.log_message(" Obteniendo logs del servidor...")

        def fetch_and_display():
            import urllib.request
            import ssl
            import json

            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE

            try:
                # Intentar obtener logs del servidor
                with urllib.request.urlopen("http://localhost:3001/logs?lines=200", context=ctx, timeout=5) as response:
                    if response.getcode() == 200:
                        data = json.loads(response.read().decode())
                        logs = data.get('logs', [])

                        if logs:
                            self.root.after(0, lambda: self.show_logs_window(logs, data.get('logFile', 'logs')))
                        else:
                            self.root.after(0, lambda: self.log_message("ℹ️ No hay logs disponibles"))
                    else:
                        self.root.after(0, lambda: self.log_message(" Error obteniendo logs del servidor"))
            except Exception:
                # Fallback: intentar leer archivo local
                self.root.after(0, lambda: self.log_message(" Servidor no responde, intentando leer archivo local..."))
                self.root.after(0, lambda: self.read_local_logs())

        threading.Thread(target=fetch_and_display, daemon=True).start()

    def read_local_logs(self):
        """Leer logs del archivo local si el servidor no responde"""
        import os
        from datetime import datetime

        logs_dir = os.path.join(os.getcwd(), 'logs')
        if not os.path.exists(logs_dir):
            self.log_message(" Directorio de logs no existe")
            return

        # Buscar el archivo de log del día actual
        today = datetime.now().strftime('%Y-%m-%d')
        log_file = os.path.join(logs_dir, f'print-server-{today}.log')

        if not os.path.exists(log_file):
            # Buscar el archivo más reciente
            log_files = [f for f in os.listdir(logs_dir) if f.endswith('.log')]
            if not log_files:
                self.log_message(" No se encontraron archivos de logs")
                return
            log_files.sort(reverse=True)
            log_file = os.path.join(logs_dir, log_files[0])

        try:
            import json
            with open(log_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()[-200:]  # Últimas 200 líneas
                logs = []
                for line in lines:
                    try:
                        logs.append(json.loads(line.strip()))
                    except:
                        pass

                if logs:
                    self.show_logs_window(logs, os.path.basename(log_file))
                else:
                    self.log_message(" No se pudieron parsear los logs")
        except Exception as e:
            self.log_message(f" Error leyendo logs: {str(e)}")

    def show_logs_window(self, logs, log_file_name):
        """Mostrar ventana con los logs"""
        logs_window = tk.Toplevel(self.root)
        logs_window.title(f" Logs del Servidor - {log_file_name}")
        logs_window.geometry("900x600")
        logs_window.configure(bg=self.colors['bg'])

        # Frame principal
        main_frame = tk.Frame(logs_window, bg=self.colors['bg'])
        main_frame.pack(fill=tk.BOTH, expand=True, padx=15, pady=15)

        # Header
        header = tk.Frame(main_frame, bg=self.colors['light'], relief=tk.RAISED, bd=1)
        header.pack(fill=tk.X, pady=(0, 10), ipady=10)

        tk.Label(header, text=f" Archivo: {log_file_name}",
                font=("Segoe UI", 12, "bold"),
                fg=self.colors['dark'], bg=self.colors['light']).pack(side=tk.LEFT, padx=10)

        tk.Label(header, text=f"Total: {len(logs)} entradas",
                font=("Segoe UI", 10),
                fg=self.colors['secondary'], bg=self.colors['light']).pack(side=tk.LEFT, padx=10)

        # Filtros
        filter_frame = tk.Frame(main_frame, bg=self.colors['light'], relief=tk.RAISED, bd=1)
        filter_frame.pack(fill=tk.X, pady=(0, 10), ipady=5)

        tk.Label(filter_frame, text="Filtrar:",
                font=("Segoe UI", 9, "bold"),
                fg=self.colors['dark'], bg=self.colors['light']).pack(side=tk.LEFT, padx=10)

        filter_var = tk.StringVar(value="ALL")

        tk.Radiobutton(filter_frame, text="Todos", variable=filter_var, value="ALL",
                      bg=self.colors['light'], command=lambda: update_logs_display()).pack(side=tk.LEFT, padx=5)
        tk.Radiobutton(filter_frame, text="Solo Errores", variable=filter_var, value="ERROR",
                      bg=self.colors['light'], fg="red", command=lambda: update_logs_display()).pack(side=tk.LEFT, padx=5)
        tk.Radiobutton(filter_frame, text="Solo Info", variable=filter_var, value="INFO",
                      bg=self.colors['light'], command=lambda: update_logs_display()).pack(side=tk.LEFT, padx=5)

        # Área de texto para logs
        log_frame = tk.Frame(main_frame, bg=self.colors['light'], relief=tk.RAISED, bd=1)
        log_frame.pack(fill=tk.BOTH, expand=True, ipady=10)

        log_text = tk.Text(log_frame, font=("Consolas", 9),
                          bg="#1e1e1e", fg="#d4d4d4",
                          wrap=tk.WORD, padx=10, pady=10)
        scrollbar = tk.Scrollbar(log_frame, orient=tk.VERTICAL, command=log_text.yview)
        log_text.configure(yscrollcommand=scrollbar.set)

        log_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        # Tags para colores
        log_text.tag_config("ERROR", foreground="#f48771")
        log_text.tag_config("INFO", foreground="#4fc1ff")
        log_text.tag_config("timestamp", foreground="#858585")
        log_text.tag_config("mesa", foreground="#4ec9b0")

        def update_logs_display():
            log_text.config(state=tk.NORMAL)
            log_text.delete(1.0, tk.END)

            filter_level = filter_var.get()
            filtered_logs = logs if filter_level == "ALL" else [l for l in logs if l.get('level') == filter_level]

            for log_entry in filtered_logs:
                timestamp = log_entry.get('timestamp', '')[:19].replace('T', ' ')
                level = log_entry.get('level', 'INFO')
                message = log_entry.get('message', '')

                # Timestamp
                log_text.insert(tk.END, f"[{timestamp}] ", "timestamp")

                # Level
                log_text.insert(tk.END, f"[{level}] ", level)

                # Message
                if 'Mesa' in message or 'mesa' in message:
                    log_text.insert(tk.END, f"{message}\n", "mesa")
                else:
                    log_text.insert(tk.END, f"{message}\n")

                # Metadata si existe
                metadata_keys = [k for k in log_entry.keys() if k not in ['timestamp', 'level', 'message']]
                if metadata_keys:
                    for key in metadata_keys:
                        log_text.insert(tk.END, f"  → {key}: {log_entry[key]}\n", "timestamp")

            log_text.config(state=tk.DISABLED)
            log_text.see(tk.END)

        # Botones de acción
        button_frame = tk.Frame(main_frame, bg=self.colors['bg'])
        button_frame.pack(fill=tk.X, pady=(10, 0))

        tk.Button(button_frame, text="🔄 Actualizar",
                 command=lambda: self.view_logs(),
                 font=("Segoe UI", 9),
                 bg=self.colors['primary'], fg="white",
                 width=12, bd=0, cursor="hand2").pack(side=tk.LEFT, padx=5)

        tk.Button(button_frame, text="📁 Abrir Carpeta",
                 command=lambda: self.open_logs_folder(),
                 font=("Segoe UI", 9),
                 bg=self.colors['secondary'], fg="white",
                 width=12, bd=0, cursor="hand2").pack(side=tk.LEFT, padx=5)

        tk.Button(button_frame, text=" Cerrar",
                 command=logs_window.destroy,
                 font=("Segoe UI", 9),
                 bg=self.colors['danger'], fg="white",
                 width=12, bd=0, cursor="hand2").pack(side=tk.RIGHT, padx=5)

        # Mostrar logs inicialmente
        update_logs_display()

        self.log_message(f" Logs cargados: {len(logs)} entradas")

    def open_logs_folder(self):
        """Abrir la carpeta de logs en el explorador"""
        import os
        import subprocess

        logs_dir = os.path.join(os.getcwd(), 'logs')
        if os.path.exists(logs_dir):
            if sys.platform == "win32":
                os.startfile(logs_dir)
            elif sys.platform == "darwin":
                subprocess.run(["open", logs_dir])
            else:
                subprocess.run(["xdg-open", logs_dir])
            self.log_message("📁 Carpeta de logs abierta")
        else:
            self.log_message(" Carpeta de logs no existe")

    def on_closing(self):
        """Manejar el cierre de la ventana"""
        if self.is_running:
            if messagebox.askquestion("Confirmar", 
                                    "El servidor está ejecutándose.\n¿Desea detenerlo y cerrar?") == "yes":
                self.stop_server()
                self.root.destroy()
        else:
            self.root.destroy()
    
    def run(self):
        """Ejecutar la aplicación"""
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        self.root.mainloop()

if __name__ == "__main__":
    app = ThermalPrinterLauncher()
    app.run()