# ============================================================
# CODE À AJOUTER À VOTRE BACKEND OHMGUARD DE PRODUCTION
# Pour les notifications push de l'application mobile
# ============================================================

# -------------------- IMPORTS À AJOUTER --------------------
import httpx
from datetime import datetime, timezone

# -------------------- MODÈLE PYDANTIC --------------------
# Ajoutez ce modèle avec vos autres modèles Pydantic

class PushTokenRequest(BaseModel):
    token: str
    device_type: Optional[str] = None  # 'ios' ou 'android'

# -------------------- COLLECTION MONGODB --------------------
# Créez une collection "push_tokens" dans votre base de données
# Structure d'un document:
# {
#   "id": "uuid",
#   "user_id": "user_uuid",
#   "tenant_id": "tenant_uuid", 
#   "token": "ExponentPushToken[xxx]",
#   "device_type": "android",
#   "created_at": "2024-01-24T12:00:00Z",
#   "updated_at": "2024-01-24T12:00:00Z"
# }

# -------------------- FONCTION D'ENVOI DE NOTIFICATIONS --------------------

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

async def send_expo_push_notification(tokens: list, title: str, body: str, data: dict = None):
    """
    Envoie une notification push via l'API Expo Push
    
    Args:
        tokens: Liste des tokens Expo Push (ExponentPushToken[xxx])
        title: Titre de la notification
        body: Corps de la notification
        data: Données supplémentaires (optionnel)
    """
    if not tokens:
        return None
    
    messages = []
    for token in tokens:
        if not token or not token.startswith('ExponentPushToken'):
            continue
        message = {
            "to": token,
            "sound": "default",
            "title": title,
            "body": body,
            "priority": "high",
            "channelId": "alerts",  # Canal Android pour les alertes
        }
        if data:
            message["data"] = data
        messages.append(message)
    
    if not messages:
        return None
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                }
            )
            result = response.json()
            print(f"[Push] Notification envoyée: {result}")
            return result
    except Exception as e:
        print(f"[Push] Erreur d'envoi: {e}")
        return None


async def send_notification_to_tenant(db, tenant_id: str, title: str, body: str, data: dict = None):
    """
    Envoie une notification à tous les utilisateurs d'un tenant
    
    Args:
        db: Instance de la base de données
        tenant_id: ID du tenant
        title: Titre de la notification
        body: Corps de la notification
        data: Données supplémentaires (optionnel)
    """
    # Récupérer tous les tokens push du tenant
    tokens_cursor = db.push_tokens.find({"tenant_id": tenant_id}, {"token": 1, "_id": 0})
    tokens = await tokens_cursor.to_list(length=100)
    token_list = [t["token"] for t in tokens if t.get("token")]
    
    if token_list:
        await send_expo_push_notification(token_list, title, body, data)
        print(f"[Push] Notification envoyée à {len(token_list)} appareils pour le tenant {tenant_id}")
    else:
        print(f"[Push] Aucun appareil enregistré pour le tenant {tenant_id}")


# -------------------- ENDPOINTS API --------------------

# Endpoint pour enregistrer un token push
@api_router.post("/push-tokens", status_code=201)
async def register_push_token(
    token_data: PushTokenRequest,
    current_user = Depends(get_current_user),  # Adaptez selon votre système d'auth
    db = Depends(get_database)  # Adaptez selon votre système de DB
):
    """Enregistre ou met à jour un token push pour l'utilisateur connecté"""
    
    # Vérifier si le token existe déjà pour cet utilisateur
    existing = await db.push_tokens.find_one({
        "user_id": current_user.id,
        "token": token_data.token
    })
    
    if existing:
        # Mettre à jour le token existant
        await db.push_tokens.update_one(
            {"_id": existing["_id"]},
            {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"message": "Token mis à jour", "token_id": existing.get("id")}
    
    # Créer un nouveau token
    import uuid
    push_token = {
        "id": str(uuid.uuid4()),
        "user_id": current_user.id,
        "tenant_id": current_user.tenant_id,
        "token": token_data.token,
        "device_type": token_data.device_type,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.push_tokens.insert_one(push_token)
    print(f"[Push] Nouveau token enregistré pour l'utilisateur {current_user.id}")
    
    return {"message": "Token enregistré", "token_id": push_token["id"]}


# Endpoint pour supprimer un token push (déconnexion)
@api_router.delete("/push-tokens")
async def delete_push_token(
    token: str = Query(...),
    current_user = Depends(get_current_user),
    db = Depends(get_database)
):
    """Supprime un token push (appelé lors de la déconnexion)"""
    
    result = await db.push_tokens.delete_one({
        "user_id": current_user.id,
        "token": token
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Token non trouvé")
    
    return {"message": "Token supprimé"}


# -------------------- INTÉGRATION AVEC LA DÉTECTION DE CHUTE --------------------

# Ajoutez ce code dans votre fonction qui crée un événement de chute
# (adaptez selon votre structure de code existante)

async def on_fall_detected(db, event: dict, tenant_id: str):
    """
    Appelée quand une chute est détectée
    Envoie une notification push à tous les utilisateurs du tenant
    """
    
    # Construire le message de notification
    location = event.get("location", "Localisation inconnue")
    
    # Envoyer la notification
    await send_notification_to_tenant(
        db,
        tenant_id,
        title="🚨 ALERTE CHUTE DÉTECTÉE",
        body=f"Chute détectée - {location}",
        data={
            "type": "new_event",
            "eventId": event.get("id"),
            "eventType": "FALL",
            "location": location,
            "severity": event.get("severity", "HIGH")
        }
    )


# -------------------- EXEMPLE D'UTILISATION --------------------

# Dans votre code de création d'événement de chute, ajoutez:
#
# async def create_fall_event(...):
#     # ... votre code existant pour créer l'événement ...
#     
#     event = await db.events.insert_one(event_data)
#     
#     # Envoyer la notification push
#     await on_fall_detected(db, event_data, tenant_id)
#     
#     return event

# ============================================================
# FIN DU CODE À AJOUTER
# ============================================================
