import json
import os
import secrets
import smtplib
from email.message import EmailMessage
from datetime import date

import psycopg2
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000", "http://localhost:8001", "http://127.0.0.1:8001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class OrdenNueva(BaseModel):
    fecha: date
    sucursal: str = "Granados"
    cliente: str
    marca_llanta_nueva: str = ""
    medida_llanta_nueva: str = ""
    cantidad_llantas: int | None = None
    servicios: list[str] = []
    observaciones_vendedor: str = ""
    correo: str = ""
    telefono: str = ""
    asesor: str = ""
    numero_orden: str | None = None

class InstalacionOrden(BaseModel):
    placa: str = ""
    kilometraje: int | None = None
    marca_llanta_vieja: str = ""
    medida_llanta_vieja: str = ""
    codigo_dot: str = ""
    elementos_presentes: list[str] = []
    observaciones_ingreso: str = ""
    mapa_danos: list = []  

class NotificacionConsentimiento(BaseModel):
    correo: str

class LoginRequest(BaseModel):
    usuario: str
    password: str

def conectar():
    return psycopg2.connect(
        dbname=os.getenv("LLANTAS_DB_NAME", "llantas247"),
        user=os.getenv("LLANTAS_DB_USER", "postgres"),
        password=os.getenv("LLANTAS_DB_PASSWORD"),
        host=os.getenv("LLANTAS_DB_HOST", "localhost"),
        port=os.getenv("LLANTAS_DB_PORT", "5432"),
    )

def enviar_correo(destinatario, asunto, contenido_texto, contenido_html=None):
    remitente = "notificaciones@llantas247.com" 
    app_password = "pssetwsknmsjfyrq" 
    
    mensaje = EmailMessage()
    mensaje["From"] = remitente
    mensaje["To"] = destinatario
    mensaje["Subject"] = asunto
    
    mensaje.set_content(contenido_texto)
    if contenido_html:
        mensaje.add_alternative(contenido_html, subtype='html')
    
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as servidor:
        servidor.login(remitente, app_password)
        servidor.send_message(mensaje)
        
def preparar_tabla(cursor):
    cursor.execute("CREATE SEQUENCE IF NOT EXISTS ordenes_numero_seq")
    cursor.execute("ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS numero_orden VARCHAR(30)")
    cursor.execute("ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS instalacion JSONB")
    cursor.execute("ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    cursor.execute("ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS sucursal VARCHAR(80) DEFAULT 'Granados'")
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        usuario VARCHAR(50) UNIQUE,
        password VARCHAR(50),
        rol VARCHAR(20)
    )
    """)
    
    cursor.execute("SELECT COUNT(*) FROM usuarios")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO usuarios (usuario, password, rol) VALUES ('admin', 'admin123', 'admin')")
        cursor.execute("INSERT INTO usuarios (usuario, password, rol) VALUES ('ventas', 'ventas123', 'asesor')")
        cursor.execute("INSERT INTO usuarios (usuario, password, rol) VALUES ('tecnico', 'tecnico123', 'tecnico')")

    cursor.execute("SELECT COUNT(*) FROM usuarios WHERE usuario = 'reportes'")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO usuarios (usuario, password, rol) VALUES ('reportes', 'reportes123', 'reporteria')")

    cursor.execute("SELECT COUNT(*) FROM ordenes")
    if cursor.fetchone()[0] == 0:
        cursor.execute("ALTER SEQUENCE ordenes_numero_seq RESTART WITH 1")

@app.post("/api/login")
def login(credenciales: LoginRequest):
    conexion = None
    try:
        conexion = conectar()
        with conexion.cursor() as cursor:
            preparar_tabla(cursor)
            cursor.execute("SELECT rol FROM usuarios WHERE usuario = %s AND password = %s", (credenciales.usuario, credenciales.password))
            fila = cursor.fetchone()
            if not fila:
                raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
            token = secrets.token_hex(16)
            return {"mensaje": "Login exitoso", "token": token, "rol": fila[0], "usuario": credenciales.usuario}
    except HTTPException:
        raise
    except psycopg2.Error as error:
        raise HTTPException(status_code=500, detail="Error de base de datos en el login.") from error
    finally:
        if conexion:
            conexion.close()

@app.get("/api/proximo-numero/{anio}")
def proximo_numero(anio: int):
    conexion = None
    try:
        conexion = conectar()
        with conexion.cursor() as cursor:
            preparar_tabla(cursor)
            cursor.execute("SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END FROM ordenes_numero_seq")
            siguiente = cursor.fetchone()[0]
        conexion.commit()
        return {"numero_orden": f"#ORD-{anio}-{siguiente:04d}"}
    except psycopg2.Error as error:
        if conexion:
            conexion.rollback()
        raise HTTPException(status_code=500, detail="No se pudo consultar el siguiente número de orden.") from error
    finally:
        if conexion:
            conexion.close()

@app.post("/api/guardar-orden")
def guardar_orden(orden: OrdenNueva):
    conexion = None
    try:
        conexion = conectar()
        with conexion.cursor() as cursor:
            preparar_tabla(cursor)
            
            numero_orden = orden.numero_orden
            if not numero_orden or numero_orden == "#ORD-2026-0000":
                cursor.execute(
                    "SELECT %s || '-' || LPAD(nextval('ordenes_numero_seq')::text, 4, '0')",
                    (f"#ORD-{orden.fecha.year}",),
                )
                numero_orden = cursor.fetchone()[0]
            
            cursor.execute("SELECT id, instalacion FROM ordenes WHERE numero_orden = %s", (numero_orden,))
            fila = cursor.fetchone()
            
            nueva_instalacion = {
                "marca_llanta_nueva": orden.marca_llanta_nueva,
                "medida_llanta_nueva": orden.medida_llanta_nueva,
                "cantidad_llantas": orden.cantidad_llantas,
                "servicios": orden.servicios,
                "observaciones_vendedor": orden.observaciones_vendedor,
            }

            if fila:
                cursor.execute(
                    """
                    UPDATE ordenes 
                    SET fecha = %s, sucursal = %s, cliente = %s, correo = %s, telefono = %s, asesor = %s,
                        instalacion = COALESCE(instalacion, '{}'::jsonb) || %s::jsonb
                    WHERE numero_orden = %s
                    """,
                    (orden.fecha, orden.sucursal, orden.cliente, orden.correo, orden.telefono, orden.asesor, json.dumps(nueva_instalacion), numero_orden)
                )
            else:
                cursor.execute(
                    """
                    INSERT INTO ordenes (fecha, sucursal, cliente, correo, telefono, asesor, numero_orden, instalacion)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                    """,
                    (orden.fecha, orden.sucursal, orden.cliente, orden.correo, orden.telefono, orden.asesor, numero_orden, json.dumps(nueva_instalacion)),
                )
        conexion.commit()
        return {"mensaje": "Orden guardada exitosamente en PostgreSQL", "numero_orden": numero_orden}
    except psycopg2.Error as error:
        if conexion:
            conexion.rollback()
        raise HTTPException(status_code=500, detail="No se pudo guardar la orden en PostgreSQL.") from error
    finally:
        if conexion:
            conexion.close()

@app.get("/api/ordenes-recientes/{sucursal}")
def ordenes_recientes(sucursal: str):
    conexion = None
    try:
        conexion = conectar()
        with conexion.cursor() as cursor:
            preparar_tabla(cursor)
            cursor.execute(
                """
                SELECT numero_orden, fecha, cliente, instalacion IS NOT NULL
                FROM ordenes
                WHERE sucursal = %s AND numero_orden IS NOT NULL
                ORDER BY creado_en DESC, id DESC
                LIMIT 20
                """,
                (sucursal,),
            )
            ordenes = [
                {"numero_orden": row[0], "fecha": row[1].isoformat(), "cliente": row[2], "instalacion_guardada": row[3]}
                for row in cursor.fetchall()
            ]
        conexion.commit()
        return {"sucursal": sucursal, "ordenes": ordenes}
    except psycopg2.Error as error:
        if conexion:
            conexion.rollback()
        raise HTTPException(status_code=500, detail="No se pudieron consultar las órdenes recientes.") from error
    finally:
        if conexion:
            conexion.close()

@app.get("/api/orden/{numero_orden}")
def obtener_orden(numero_orden: str):
    conexion = None
    try:
        conexion = conectar()
        with conexion.cursor() as cursor:
            preparar_tabla(cursor)
            cursor.execute(
                "SELECT numero_orden, fecha, sucursal, cliente, correo, telefono, asesor, instalacion FROM ordenes WHERE numero_orden = %s",
                (numero_orden,),
            )
            fila = cursor.fetchone()
        conexion.commit()
        if not fila:
            raise HTTPException(status_code=404, detail="No se encontró la orden indicada.")
        return {
            "numero_orden": fila[0],
            "fecha": fila[1].isoformat(),
            "sucursal": fila[2],
            "cliente": fila[3],
            "correo": fila[4],
            "telefono": fila[5],
            "asesor": fila[6],
            "instalacion": fila[7],
        }
    except HTTPException:
        raise
    except psycopg2.Error as error:
        if conexion:
            conexion.rollback()
        raise HTTPException(status_code=500, detail="No se pudo consultar la orden.") from error
    finally:
        if conexion:
            conexion.close()

@app.put("/api/guardar-instalacion/{numero_orden}")
def guardar_instalacion(numero_orden: str, instalacion: InstalacionOrden):
    conexion = None
    try:
        conexion = conectar()
        with conexion.cursor() as cursor:
            preparar_tabla(cursor)
            cursor.execute(
                "UPDATE ordenes SET instalacion = COALESCE(instalacion, '{}'::jsonb) || %s::jsonb WHERE numero_orden = %s",
                (json.dumps(instalacion.model_dump(exclude_none=True)), numero_orden),
            )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="No se encontró la orden indicada.")
        conexion.commit()
        return {"mensaje": "Datos de instalación guardados exitosamente", "numero_orden": numero_orden}
    except HTTPException:
        if conexion:
            conexion.rollback()
        raise
    except psycopg2.Error as error:
        if conexion:
            conexion.rollback()
        raise HTTPException(status_code=500, detail="No se pudieron guardar los datos de instalación.") from error
    finally:
        if conexion:
            conexion.close()

@app.post("/api/notificar-consentimiento/{numero_orden}/{responsable}")
def notificar_consentimiento(numero_orden: str, responsable: str, notificacion: NotificacionConsentimiento):
    conexion = None
    try:
        conexion = conectar()
        with conexion.cursor() as cursor:
            preparar_tabla(cursor)
            cursor.execute("SELECT cliente, instalacion FROM ordenes WHERE numero_orden = %s", (numero_orden,))
            fila = cursor.fetchone()
            
            if not fila:
                cursor.execute(
                    """
                    INSERT INTO ordenes (fecha, sucursal, cliente, correo, numero_orden, instalacion)
                    VALUES (CURRENT_DATE, 'Granados', 'Cliente en trámite', %s, %s, '{}'::jsonb)
                    """,
                    (notificacion.correo, numero_orden)
                )
                cursor.execute("SELECT cliente, instalacion FROM ordenes WHERE numero_orden = %s", (numero_orden,))
                fila = cursor.fetchone()
            
            cliente_nombre = fila[0] or "Cliente"
            datos = fila[1] or {}
            tokens = datos.get("consentimientos", {})
            token = secrets.token_urlsafe(32)
            
            tokens[responsable] = {"token": token, "estado": "notificado", "correo": notificacion.correo}
            datos["consentimientos"] = tokens
            cursor.execute("UPDATE ordenes SET instalacion = %s::jsonb WHERE numero_orden = %s", (json.dumps(datos), numero_orden))
        conexion.commit()
        
        public_url = os.getenv("LLANTAS_PUBLIC_URL", "http://localhost:8001")
        aceptar = f"{public_url}/api/consentimiento/{token}/aprobado"
        rechazar = f"{public_url}/api/consentimiento/{token}/rechazado"
        
        texto_plano = f"Se solicita revisar y responder la orden {numero_orden}.\n\nAceptar: {aceptar}\nRechazar: {rechazar}\n"
        
        # 👉 CORREOS CREATIVOS, FORMALES Y ESTILO BANCARIO
        if responsable == "client_datos":
            asunto = f"[Seguridad y Privacidad] Autorización de Datos Personales (LOPDP) - Orden {numero_orden}"
            html_content = f"""
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
              <div style="background: linear-gradient(135deg, #10182e 0%, #1e2c4d 100%); padding: 30px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">LLANTAS <span style="color: #ed0010;">247</span></h1>
                <p style="color: #9fb0cc; margin: 6px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Protección de Datos y Confidencialidad</p>
              </div>
              <div style="padding: 36px 30px;">
                <h2 style="color: #111827; margin-top: 0; font-size: 18px; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px;">Estimado/a <strong>{cliente_nombre}</strong>,</h2>
                <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">En cumplimiento de la Ley Orgánica de Protección de Datos Personales (LOPDP), en <strong>Llantas 247</strong> garantizamos la seguridad absoluta de su información.</p>
                <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">Para proceder con el registro, mantenimiento y trazabilidad vehicular de su Orden de Servicio <strong>{numero_orden}</strong>, requerimos su consentimiento previo y expreso.</p>
                
                <div style="background-color: #f8fafc; border-left: 4px solid #ed0010; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
                  <p style="margin: 0; font-size: 13px; color: #334155; line-height: 1.5;">Sus datos serán tratados exclusivamente para fines comerciales, de facturación y notificaciones operativas autorizadas.</p>
                </div>
                
                <div style="text-align: center; margin-top: 36px;">
                  <a href="{aceptar}" style="display: inline-block; background-color: #00bd7b; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 14px; box-shadow: 0 4px 12px rgba(0,189,123,0.3); margin-right: 12px;">Aceptar y Autorizar</a>
                  <a href="{rechazar}" style="display: inline-block; background-color: #f1f5f9; color: #64748b; text-decoration: none; padding: 14px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; border: 1px solid #cbd5e1;">Rechazar</a>
                </div>
              </div>
              <div style="background-color: #f8fafc; padding: 18px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 11px; color: #94a3b8;">Aviso de Confidencialidad: Este mensaje es seguro y exclusivo para el destinatario.</p>
              </div>
            </div>
            """
        elif responsable == "client_reciclaje":
            asunto = f"[Compromiso Ambiental] Autorización de Reciclaje de Neumáticos - Orden {numero_orden}"
            html_content = f"""
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
              <div style="background: linear-gradient(135deg, #10182e 0%, #1e2c4d 100%); padding: 30px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">LLANTAS <span style="color: #ed0010;">247</span></h1>
                <p style="color: #9fb0cc; margin: 6px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Gestión Ambiental Responsable</p>
              </div>
              <div style="padding: 36px 30px;">
                <h2 style="color: #111827; margin-top: 0; font-size: 18px; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px;">Estimado/a <strong>{cliente_nombre}</strong>,</h2>
                <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">En Llantas 247 estamos comprometidos con el cuidado del medio ambiente y el desarrollo sostenible.</p>
                <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">Conforme a las normativas ecológicas vigentes, solicitamos su autorización para proceder con la recolección, disposición final y tratamiento ecológico (reciclaje) de los neumáticos usados que serán sustituidos en su vehículo bajo la Orden <strong>{numero_orden}</strong>.</p>
                
                <div style="background-color: #f8fafc; border-left: 4px solid #00bd7b; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0;">
                  <p style="margin: 0; font-size: 13px; color: #334155; line-height: 1.5;">Mediante esta validación, usted cede los neumáticos retirados para evitar la contaminación ambiental, eximiendo de responsabilidad futura sobre los mismos.</p>
                </div>
                
                <div style="text-align: center; margin-top: 36px;">
                  <a href="{aceptar}" style="display: inline-block; background-color: #00bd7b; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 14px; box-shadow: 0 4px 12px rgba(0,189,123,0.3); margin-right: 12px;">Aceptar y Autorizar</a>
                  <a href="{rechazar}" style="display: inline-block; background-color: #f1f5f9; color: #64748b; text-decoration: none; padding: 14px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; border: 1px solid #cbd5e1;">Rechazar</a>
                </div>
              </div>
              <div style="background-color: #f8fafc; padding: 18px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 11px; color: #94a3b8;">Llantas 247 · Innovación y tecnología en servicios automotrices con conciencia ecológica.</p>
              </div>
            </div>
            """
        else:
            asunto = f"[Operativo] Solicitud de Validación Interna - Orden {numero_orden}"
            html_content = f"""
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
              <div style="background: linear-gradient(135deg, #10182e 0%, #1e2c4d 100%); padding: 30px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px;">LLANTAS <span style="color: #ed0010;">247</span></h1>
                <p style="color: #9fb0cc; margin: 6px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Control Operativo de Taller</p>
              </div>
              <div style="padding: 36px 30px; text-align: center;">
                <h2 style="color: #111827; margin-top: 0; font-size: 18px;">Aprobación Técnica Requerida</h2>
                <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">Se ha generado una solicitud de validación para el avance y registro operativo de la Orden de Servicio <strong>{numero_orden}</strong>.</p>
                <div style="margin-top: 36px;">
                  <a href="{aceptar}" style="display: inline-block; background-color: #00bd7b; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 14px; margin-right: 12px;">Aprobar Orden</a>
                  <a href="{rechazar}" style="display: inline-block; background-color: #f1f5f9; color: #64748b; text-decoration: none; padding: 14px 24px; border-radius: 8px; font-weight: bold; font-size: 14px; border: 1px solid #cbd5e1;">Rechazar</a>
                </div>
              </div>
            </div>
            """

        enviar_correo(notificacion.correo, asunto, texto_plano, html_content)
        return {"mensaje": f"Notificación enviada a {notificacion.correo}"}
    except HTTPException:
        if conexion:
            conexion.rollback()
        raise
    except (psycopg2.Error, OSError, smtplib.SMTPException) as error:
        if conexion:
            conexion.rollback()
        raise HTTPException(status_code=500, detail="No se pudo enviar la notificación.") from error
    finally:
        if conexion:
            conexion.close()

@app.post("/api/aprobar-local/{numero_orden}/{responsable}")
def aprobar_local(numero_orden: str, responsable: str):
    conexion = None
    try:
        conexion = conectar()
        with conexion.cursor() as cursor:
            cursor.execute("SELECT instalacion FROM ordenes WHERE numero_orden = %s", (numero_orden,))
            fila = cursor.fetchone()
            if not fila:
                raise HTTPException(status_code=404, detail="Orden no encontrada")
            
            datos = fila[0] or {}
            tokens = datos.get("consentimientos", {})
            
            if responsable not in tokens:
                tokens[responsable] = {"token": "firma_local", "estado": "aprobado", "correo": "Aprobación Física (Web)"}
            else:
                tokens[responsable]["estado"] = "aprobado"
                
            datos["consentimientos"] = tokens
            cursor.execute("UPDATE ordenes SET instalacion = %s::jsonb WHERE numero_orden = %s", (json.dumps(datos), numero_orden))
        conexion.commit()
        return {"mensaje": "Aprobado localmente"}
    except Exception as e:
        if conexion:
            conexion.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conexion:
            conexion.close()

@app.get("/api/consentimiento/{token}/{estado}")
def responder_consentimiento(token: str, estado: str):
    if estado not in {"aprobado", "rechazado"}:
        raise HTTPException(status_code=400, detail="Respuesta no válida.")
    conexion = None
    try:
        conexion = conectar()
        with conexion.cursor() as cursor:
            cursor.execute("SELECT numero_orden, instalacion FROM ordenes WHERE instalacion ? 'consentimientos'")
            filas = cursor.fetchall()
            
            fila_encontrada = None
            responsable_encontrado = None
            datos_json = None
            
            for row in filas:
                num_ord = row[0]
                inst = row[1] or {}
                consentimientos = inst.get("consentimientos", {})
                for r_key, c_data in consentimientos.items():
                    if c_data.get("token") == token:
                        fila_encontrada = num_ord
                        responsable_encontrado = r_key
                        datos_json = inst
                        break
                if fila_encontrada:
                    break
            
            if not fila_encontrada:
                raise HTTPException(status_code=404, detail="Enlace no válido.")
            
            consentimiento_actual = datos_json["consentimientos"][responsable_encontrado]
            if consentimiento_actual.get("estado") in {"aprobado", "rechazado"}:
                return HTMLResponse(content=f"""
                <html><body style="font-family: Arial; text-align: center; padding: 50px; background: #f8fafc;">
                    <h2 style="color: #2563eb;">Esta autorización ya fue procesada</h2>
                    <p>El estado registrado es: <strong>{consentimiento_actual.get("estado").capitalize()}</strong>.</p>
                    <p style="color: #64748b; font-size: 14px; margin-top: 20px;">Ya puedes cerrar esta ventana.</p>
                </body></html>
                """, status_code=200)
            
            consentimiento_actual["estado"] = estado
            cursor.execute("UPDATE ordenes SET instalacion = %s::jsonb WHERE numero_orden = %s", (json.dumps(datos_json), fila_encontrada))
        conexion.commit()
        
        if responsable_encontrado == "client_datos":
            titulo = f"Protección de Datos {estado.capitalize()}"
        elif responsable_encontrado == "client_reciclaje":
            titulo = f"Reciclaje de Llantas {estado.capitalize()}"
        else:
            titulo = f"Orden de Servicio {estado.capitalize()}"
            
        html_respuesta = f"""
        <html><body style="font-family: Arial; text-align: center; padding: 50px; background: #f8fafc; font-family: 'Space Grotesk', sans-serif;">
            <div style="max-width: 500px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                <h2 style="color: {'#00bd7b' if estado == 'aprobado' else '#ed0010'}; margin-top: 0; font-size: 24px;">
                    {titulo}
                </h2>
                <p style="color: #4b5563; font-size: 15px; line-height: 1.5;">Su respuesta ha sido registrada exitosamente en el sistema del taller.</p>
                <p style="color: #7890b0; font-size: 13px; margin-top: 25px;">Ya puedes cerrar esta ventana de forma segura.</p>
            </div>
        </body></html>
        """
        return HTMLResponse(content=html_respuesta, status_code=200)
    except HTTPException:
        if conexion:
            conexion.rollback()
        raise
    finally:
        if conexion:
            conexion.close()

@app.get("/api/reportes")
def obtener_reportes(fecha_inicio: str = None, fecha_fin: str = None, asesor: str = None, sucursal: str = None):
    conexion = None
    try:
        conexion = conectar()
        with conexion.cursor() as cursor:
            query = "SELECT numero_orden, fecha, cliente, asesor, sucursal, instalacion FROM ordenes WHERE 1=1"
            params = []
            
            if fecha_inicio:
                query += " AND fecha >= %s"
                params.append(fecha_inicio)
            if fecha_fin:
                query += " AND fecha <= %s"
                params.append(fecha_fin)
            if asesor:
                query += " AND asesor = %s"
                params.append(asesor)
            if sucursal:
                query += " AND sucursal = %s"
                params.append(sucursal)
            
            query += " ORDER BY fecha DESC"
            cursor.execute(query, tuple(params))
            
            resultados = []
            for r in cursor.fetchall():
                inst = r[5] or {}
                servicios = inst.get("servicios", [])
                placa = inst.get("placa", "N/A")
                if not placa: placa = "N/A"
                
                resultados.append({
                    "numero_orden": r[0],
                    "fecha": r[1].isoformat(),
                    "cliente": r[2],
                    "asesor": r[3] or '-',
                    "sucursal": r[4],
                    "placa": placa,
                    "servicios": ", ".join(servicios) if servicios else "Ninguno"
                })
            return {"reportes": resultados}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conexion:
            conexion.close()

app.mount("/", StaticFiles(directory=".", html=True), name="static")