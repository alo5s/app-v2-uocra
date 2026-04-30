from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, CV, Empresa, CVEmpresa, Nota
from app.schemas.schemas import DashboardStats

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    total_cvs = db.query(CV).count()
    activos = db.query(CV).filter(CV.estado == 'aprobado').count()
    
    afiliados = db.query(CV).filter(CV.afiliado == 'si').count()
    fueron_afiliados = db.query(CV).filter(CV.afiliado == 'fue').count()
    no_afiliados = db.query(CV).filter(CV.afiliado == 'no').count()
    
    cv_con_empresa = db.query(CVEmpresa.cv_id).distinct().subquery()
    sin_exp_count = db.query(CV).filter(
        CV.sin_experiencia == True,
        ~CV.id.in_(cv_con_empresa)
    ).count()

    total_users = db.query(User).count()
    total_empresas = db.query(Empresa).filter(Empresa.deleted_at == None).count()
    total_notas = db.query(Nota).count()
    
    empresas_activas = db.query(CVEmpresa).filter(CVEmpresa.activo == True).count()
    
    return DashboardStats(
        total_cvs=total_cvs,
        activos=activos,
        afiliados=afiliados,
        fueron_afiliados=fueron_afiliados,
        no_afiliados=no_afiliados,
        sin_exp_count=sin_exp_count,
        total_users=total_users,
        total_empresas=total_empresas,
        empresas_activas=empresas_activas,
        total_notas=total_notas
    )


@router.get("/por-oficio", response_model=list[dict])
def get_cvs_por_oficio(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    results = db.query(
        CV.oficios,
        func.count(CV.id).label('cantidad')
    ).filter(
        CV.oficios != None, 
        CV.oficios != ''
    ).group_by(CV.oficios).order_by(func.count(CV.id).desc()).limit(10).all()
    
    return [{"oficio": r.oficios, "cantidad": r.cantidad} for r in results]


@router.get("/por-categoria", response_model=list[dict])
def get_cvs_por_categoria(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    results = db.query(
        CV.area,
        func.count(CV.id).label('cantidad')
    ).filter(
        CV.area != None, 
        CV.area != ''
    ).group_by(CV.area).order_by(func.count(CV.id).desc()).all()
    
    return [{"categoria": r.area, "cantidad": r.cantidad} for r in results]
