from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, Historial, Notificacion
from app.schemas.schemas import HistorialResponse, NotificacionResponse, NotificacionUpdate, MessageResponse

router = APIRouter(prefix="/actividad", tags=["actividad"])


@router.get("/historial", response_model=dict)
def get_historial(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Historial).order_by(desc(Historial.fecha))
    
    total = query.count()
    historial = query.offset((page - 1) * per_page).limit(per_page).all()
    
    return {
        "items": [HistorialResponse.model_validate(h) for h in historial],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page
    }


@router.get("/notificaciones", response_model=list[NotificacionResponse])
def get_notificaciones(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notificaciones = db.query(Notificacion).filter(
        (Notificacion.user_id == None) | (Notificacion.user_id == current_user.id)
    ).order_by(Notificacion.fecha.desc()).limit(20).all()
    
    return [NotificacionResponse.model_validate(n) for n in notificaciones]


@router.get("/notificaciones/count", response_model=dict)
def get_notificaciones_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    count = db.query(Notificacion).filter(
        Notificacion.leida == False,
        (Notificacion.user_id == None) | (Notificacion.user_id == current_user.id)
    ).count()
    
    return {"count": count}


@router.post("/notificaciones/marcar-todas-leidas", response_model=MessageResponse)
def marcar_todas_leidas(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db.query(Notificacion).filter(
        Notificacion.leida == False,
        (Notificacion.user_id == None) | (Notificacion.user_id == current_user.id)
    ).update({'leida': True})
    db.commit()
    
    return MessageResponse(message="Todas las notificaciones marcadas como leídas")


@router.put("/notificaciones/{notificacion_id}", response_model=NotificacionResponse)
def marcar_notificacion_leida(
    notificacion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notificacion = db.query(Notificacion).filter(Notificacion.id == notificacion_id).first()
    if not notificacion:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    
    notificacion.leida = True
    db.commit()
    db.refresh(notificacion)
    
    return NotificacionResponse.model_validate(notificacion)