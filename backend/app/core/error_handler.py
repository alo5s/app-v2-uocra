from fastapi import Request, FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm.exc import NoResultFound
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def generic_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Manejador genérico de errores"""
    logger.error(f"Error no manejado: {exc}", exc_info=True)
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Error interno del servidor",
            "type": "internal_error"
        }
    )


async def database_error_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """Manejador de errores de base de datos"""
    logger.error(f"Error de base de datos: {exc}")
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Error de conexión a la base de datos",
            "type": "database_error"
        }
    )


def setup_error_handlers(app: FastAPI) -> None:
    """Configura los manejadores de errores en la app"""
    app.add_exception_handler(Exception, generic_error_handler)
    app.add_exception_handler(SQLAlchemyError, database_error_handler)
