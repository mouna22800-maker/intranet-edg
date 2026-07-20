import os
import ssl
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger("edg.email")

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "no-reply@edg.com.gn")
SMTP_TLS = os.getenv("SMTP_TLS", "true").lower() == "true"


def is_configured() -> bool:
    return bool(SMTP_HOST)


def send_email(to: str, subject: str, html_body: str, text_body: str = "") -> bool:
    """
    Envoie un e-mail. Si le SMTP n'est PAS configuré (SMTP_HOST vide), on ne plante pas :
    le contenu est journalisé (utile en dev / avant la mise en place du serveur mail) et on renvoie False.
    """
    if not is_configured():
        logger.warning("SMTP non configuré — e-mail NON envoyé à %s. Sujet: %s\n%s",
                       to, subject, text_body or html_body)
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = to
        if text_body:
            msg.attach(MIMEText(text_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        if SMTP_TLS:
            context = ssl.create_default_context()
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
                server.starttls(context=context)
                if SMTP_USER:
                    server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SMTP_FROM, [to], msg.as_string())
        else:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=15) as server:
                if SMTP_USER:
                    server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SMTP_FROM, [to], msg.as_string())
        logger.info("E-mail envoyé à %s (%s)", to, subject)
        return True
    except Exception as e:
        logger.error("Échec d'envoi d'e-mail à %s : %s", to, e)
        return False
