/** Crea o actualiza un usuario. Uso: npm run user:create -- correo@dominio.com "Nombre" rol contraseña */
import bcrypt from 'bcryptjs';
import { client } from './db';

const ROLES = ['admin', 'coordinador', 'finanzas', 'transportista', 'consulta'];

async function main() {
  const [email, nombre, rol, pass] = process.argv.slice(2);
  if (!email || !nombre || !ROLES.includes(rol) || !pass || pass.length < 8) {
    console.error('Uso: npm run user:create -- correo "Nombre" <admin|coordinador|finanzas|transportista|consulta> contraseña(8+)');
    process.exit(1);
  }
  const c = await client();
  await c.query(
    `insert into usuarios (email, nombre, rol, password_hash) values (lower($1),$2,$3,$4)
     on conflict (email) do update set nombre = excluded.nombre, rol = excluded.rol, password_hash = excluded.password_hash, activo = true`,
    [email, nombre, rol, await bcrypt.hash(pass, 10)],
  );
  await c.end();
  console.log(`Usuario ${email} (${rol}) listo`);
}
main().catch((e) => { console.error(e); process.exit(1); });
