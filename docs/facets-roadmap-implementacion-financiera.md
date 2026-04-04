## Roadmap principal

| Orden | Fase                                | Depende de        | Por qué va acá                                                                                                                            | Modelos / alcance                                                                                                                   | Ejemplo ultra simple                                                                             |
| ----- | ----------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 4     | **Balances y conciliaciones**       | 3                 | Antes de mover plata en serio, tenés que cerrar cómo se mantiene el saldo correcto y cómo se corrige sin inventar transacciones falsas.   | `AccountDailyBalance`, `AccountReconciliation`                                                                                      | El sistema dice 1200, el banco real dice 1150 → reconciliás a 1150 sin registrar un gasto falso. |
| 5     | **Clasificación financiera**        | 2, 3              | Las transacciones necesitan caer sobre una taxonomía consistente desde el día 1. Si esto entra tarde, después corregir datos es doloroso. | `Category`, `SystemMerchant`, `WorkspaceMerchant`, `Tag`                                                                            | `Comida > Supermercado`, merchant `Starbucks`, tag `vacaciones`.                                 |
| 6     | **Transacciones estándar**          | 3, 4, 5           | Recién acá conviene abrir el flujo principal de cashflow: ingreso/gasto normal, con categoría, merchant y tags.                           | `Transaction`, `TransactionTag`                                                                                                     | `Supermercado 120 PEN` en tarjeta, `OUTFLOW`, `STANDARD`, categoría `Comida`.                    |
| 7     | **Multimoneda y FX**                | 3, 6              | Antes de transferencias entre monedas y reportes consolidados necesitás cerrar la política de conversión.                                 | `ExchangeRate`, uso de `currencyCode` en cuentas/transacciones                                                                      | `10 USD` el 2026-03-26 se consolida a `38 PEN` con rate `3.80`.                                  |
| 8     | **Transferencias y pagos internos** | 3, 4, 6, 7        | Esta fase evita que la app mienta. Pago de tarjeta, préstamo o deuda no pueden verse como gasto nuevo.                                    | `Transfer`, `Transaction.kind` (`FUNDS_MOVEMENT`, `CC_PAYMENT`, `LOAN_PAYMENT`, `DEBT_PAYMENT`)                                     | Pagar 300 de banco a tarjeta = 2 transacciones + 1 transfer, pero sin sumar gasto del período.   |
| 9     | **Budgets**                         | 5, 6, 8           | El budget ya necesita una semántica analítica cerrada. Si entra antes, termina contando cosas que no debería.                             | `Budget`, `BudgetLine`                                                                                                              | `Comida: presupuesto 400, gastado 280, disponible 120`.                                          |
| 10    | **Recurring reminders**             | 2, 5              | No bloquea al core, pero ya puede entrar cuando categorías, moneda y settings financieros existen.                                        | `RecurringReminder`                                                                                                                 | `Internet`, día 15, monto variable `80..110`, sin crear transacción automática.                  |
| 11    | **Reportes y dashboard agregados**  | 4, 6, 7, 8, 9, 10 | Esto tiene que ir casi al final porque consume la verdad semántica ya cerrada. Si lo hacés antes, después hay que reescribir todo.        | lecturas agregadas sobre `Account`, `AccountDailyBalance`, `Transaction`, `Transfer`, `Budget`, `ExchangeRate`, `RecurringReminder` | “Gastaste 920 este mes vs 1030 el mes pasado”.                                                   |

---

## Pendientes importantes pero NO bloqueantes para el core financiero

Estos modelos también deberían cerrarse, pero no necesitan frenar el camino principal de cuentas → transacciones → transfers → reports.

| Orden sugerido | Fase                                                  | Por qué puede ir después                                                   | Modelos / alcance                        | Ejemplo simple                                                              |
| -------------- | ----------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| 12             | **Perfil del usuario y preferencias por workspace**   | No bloquea el núcleo financiero; mejora UX y configuración personal        | `UserProfile`, `WorkspaceUserPreference` | Cambiar tema a dark y locale visual sin tocar la moneda base del workspace. |
| 13             | **Expandir `File` a documentos reales del workspace** | La infraestructura ya existe; falta convertirla en feature de producto     | `File`                                   | Subir un resumen de tarjeta o comprobante como documento del workspace.     |
| 14             | **Metering detallado append-only**                    | Billing ya funciona a buen nivel; esto mejora trazabilidad y límites finos | `UsageEvent`                             | Registrar cada uso de OCR/AI como evento individual además del rollup.      |

---

## Reglas semánticas que tenés que cerrar TEMPRANO

Estas reglas no son “detalle”. Son la diferencia entre una app que guarda datos y una app que responde bien preguntas financieras.

1. **Todo negocio va scoped por `workspaceId`.**
2. **`Transaction.kind` se materializa al escribir, no se adivina al leer.**
3. **La misma matriz de exclusión analítica debe vivir en dashboard, reports y budgets.**
4. **`FUNDS_MOVEMENT`, `CC_PAYMENT`, `DEBT_PAYMENT` y `LOAN_PAYMENT` no son gasto operativo nuevo.**
5. **`ONE_TIME` no debería contaminar promedios operativos.**
6. **`Account.currentBalanceCached`, `AccountDailyBalance` y reconciliaciones tienen que contar la misma historia.**
7. **Una reconciliación corrige estado; no crea cashflow.**
8. **Si falta FX, nunca hagas fallback silencioso a `1`.**
9. **No permitas cambiar libremente `Account.currencyCode` si la cuenta ya tiene historial.**
10. **`BudgetLine` debe apuntar solo a categorías padre.**
11. **`SystemMerchant.suggestedCategoryKey` se resuelve contra categorías reales del workspace.**
12. **El recupero de `LENT_MONEY` no debe contarse como ingreso nuevo.**

---

## Regla práctica para cerrar cada fase

Antes de pasar a la siguiente fase, cada bloque debería salir con:

- módulo;
- controller;
- service;
- repository;
- DTOs y contratos claros;
- tests unitarios;
- tests e2e;
- reglas semánticas cubiertas;
- endpoints listos para Swagger.

---

## Conclusión simple

El orden correcto no es el orden de las tablas, sino el orden de las **dependencias del dominio**:

1. primero la semántica compartida,
2. después las cuentas y la clasificación,
3. luego las transacciones,
4. después las transferencias y FX,
5. recién ahí budgets y reportes.

Si seguís ese camino, cada capa nueva se apoya sobre una base ya cerrada y no terminás reescribiendo features porque abajo faltaba una regla clave.
