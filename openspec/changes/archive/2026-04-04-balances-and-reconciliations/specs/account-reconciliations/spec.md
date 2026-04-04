# Especificación de Account Reconciliations

## Purpose

Definir conciliaciones como corrección de estado.

## Requirements

### Requirement: Conciliación no crea transacción falsa

El sistema MUST registrar una conciliación como saldo observado (`targetBalance`) para una cuenta y fecha. Una conciliación MUST NOT crear, reemplazar ni mutar `Transaction`, ni introducir gasto, ingreso o cashflow artificial en analytics o reportes. Su efecto sólo puede entrar por `adjustmentsAmount`.

#### Scenario: Diferencia entre saldo calculado y observado

- GIVEN saldo calculado `1200` y observado `1150`
- WHEN el usuario crea una conciliación a `1150`
- THEN la cuenta queda reconciliada mediante ajuste de `-50`
- AND el sistema MUST NOT persistir un gasto falso de `50`

### Requirement: Conciliación efectiva, auditoría y seguridad

Si existen múltiples conciliaciones activas para la misma cuenta y fecha, el sistema MUST tomar como efectiva la última creada de ese día. Si dos registros empatan en `createdAt`, el sistema MUST usar un desempate determinístico. Si se elimina la efectiva, MUST gobernar la siguiente más reciente. El sistema MUST exponer APIs de create/list/detail/update/delete por cuenta. List y detail MUST devolver fecha, `targetBalance`, motivo opcional, timestamps y autor. Todas las operaciones MUST validar acceso por `Account.workspaceId`.

#### Scenario: Varias conciliaciones el mismo día

- GIVEN dos conciliaciones del mismo día, creadas a las 10:00 y 18:00
- WHEN el sistema recomputa o lee el detalle del día
- THEN usa la creada a las 18:00 como efectiva
- AND la de las 10:00 queda sólo como antecedente

#### Scenario: Lectura segura

- GIVEN una conciliación de una cuenta de otro workspace
- WHEN un usuario sin acceso intenta verla o listarla
- THEN el sistema no la expone
- AND falla según la política de autorización
