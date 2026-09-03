import json
import os
import secrets
import smtplib
from email.message import EmailMessage
from datetime import date

import psycopg2
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000"],
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


class InstalacionOrden(BaseModel):
    placa: str = ""
    kilometraje: int | None = None
    codigo_alarma: str = ""
    marca_llanta_vieja: str = ""
    medida_llanta_vieja: str = ""
    codigo_dot: str = ""
    elementos_presentes: list[str] = []
    observaciones_ingreso: str = ""


class NotificacionConsentimiento(BaseModel):
    correo: str


def conectar():
    return psycopg2.connect(
        dbname=os.getenv("LLANTAS_DB_NAME", "llantas247"),
        user=os.getenv("LLANTAS_DB_USER", "postgres"),
        password=os.getenv("LLANTAS_DB_PASSWORD"),
        host=os.getenv("LLANTAS_DB_HOST", "localhost"),
        port=os.getenv("LLANTAS_DB_PORT", "5432"),
    )


def enviar_correo(destinatario, asunto, contenido):
    remitente = os.getenv("LLANTAS_GMAIL_USER", "sistemas@llantas247.com")
    app_password = os.getenv("LLANTAS_GMAIL_APP_PASSWORD")
    if not app_password:
        raise HTTPException(status_code=503, detail="Falta configurar LLANTAS_GMAIL_APP_PASSWORD.")
    mensaje = EmailMessage()
    mensaje["From"] = remitente
    mensaje["To"] = destinatario
    mensaje["Subject"] = asunto
    mensaje.set_content(contenido)
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as servidor:
        servidor.login(remitente, app_password)
        servidor.send_message(mensaje)


def preparar_tabla(cursor):
    cursor.execute("CREATE SEQUENCE IF NOT EXISTS ordenes_numero_seq")
    cursor.execute("ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS numero_orden VARCHAR(30)")
    cursor.execute("ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS instalacion JSONB")
    cursor.execute("ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    cursor.execute("ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS sucursal VARCHAR(80) DEFAULT 'Granados'")
    cursor.execute("SELECT COUNT(*) FROM ordenes")
    if cursor.fetchone()[0] == 0:
        cursor.execute("ALTER SEQUENCE ordenes_numero_seq RESTART WITH 1")


@app.get("/api/proximo-numero/{anio}")
def proximo_numero(anio: int):
    conexion = None
    try:
        conexion = conectar()
        with conexion.cursor() as cursor:
            preparar_tabla(cursor)
            cursor.execute(
                "SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END FROM ordenes_numero_seq"
            )
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
            cursor.execute(
                "SELECT %s || '-' || LPAD(nextval('ordenes_numero_seq')::text, 4, '0')",
                (f"#ORD-{orden.fecha.year}",),
            )
            numero_orden = cursor.fetchone()[0]
            cursor.execute(
                """
                INSERT INTO ordenes (fecha, sucursal, cliente, correo, telefono, asesor, numero_orden, instalacion)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                """,
                (orden.fecha, orden.sucursal, orden.cliente, orden.correo, orden.telefono, orden.asesor, numero_orden, json.dumps({
                    "marca_llanta_nueva": orden.marca_llanta_nueva,
                    "medida_llanta_nueva": orden.medida_llanta_nueva,
                    "cantidad_llantas": orden.cantidad_llantas,
                    "servicios": orden.servicios,
                    "observaciones_vendedor": orden.observaciones_vendedor,
                })),
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
            cursor.execute("SELECT cliente, instalacion FROM ordenes WHERE numero_orden = %s", (numero_orden,))
            fila = cursor.fetchone()
            if not fila:
                raise HTTPException(status_code=404, detail="No se encontró la orden indicada.")
            datos = fila[1] or {}
            tokens = datos.get("consentimientos", {})
            token = secrets.token_urlsafe(32)
            tokens[responsable] = {"token": token, "estado": "pendiente", "correo": notificacion.correo}
            datos["consentimientos"] = tokens
            cursor.execute("UPDATE ordenes SET instalacion = %s::jsonb WHERE numero_orden = %s", (json.dumps(datos), numero_orden))
        conexion.commit()
        public_url = os.getenv("LLANTAS_PUBLIC_URL", "http://localhost:8001")
        aceptar = f"{public_url}/api/consentimiento/{token}/aprobado"
        rechazar = f"{public_url}/api/consentimiento/{token}/rechazado"
        enviar_correo(
            notificacion.correo,
            f"Consentimiento requerido {numero_orden}",
            f"Se solicita revisar y responder la orden {numero_orden}.\n\nAceptar: {aceptar}\nRechazar: {rechazar}\n",
        )
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


@app.get("/api/consentimiento/{token}/{estado}")
def responder_consentimiento(token: str, estado: str):
    if estado not in {"aprobado", "rechazado"}:
        raise HTTPException(status_code=400, detail="Respuesta no válida.")
    conexion = None
    try:
        conexion = conectar()
        with conexion.cursor() as cursor:
            cursor.execute("SELECT numero_orden, instalacion FROM ordenes WHERE instalacion ? 'consentimientos'")
            fila = next((row for row in cursor.fetchall() if any(item.get("token") == token for item in (row[1] or {}).get("consentimientos", {}).values())), None)
            if not fila:
                raise HTTPException(status_code=404, detail="Enlace de consentimiento no válido.")
            datos = fila[1] or {}
            for consentimiento in datos.get("consentimientos", {}).values():
                if consentimiento.get("token") == token:
                    consentimiento["estado"] = estado
                    break
            cursor.execute("UPDATE ordenes SET instalacion = %s::jsonb WHERE numero_orden = %s", (json.dumps(datos), fila[0]))
        conexion.commit()
        return {"mensaje": f"Respuesta registrada: {estado}", "numero_orden": fila[0]}
    except HTTPException:
        if conexion:
            conexion.rollback()
        raise
    finally:
        if conexion:
            conexion.close()