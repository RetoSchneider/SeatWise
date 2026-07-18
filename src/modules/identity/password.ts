import { hash, verify } from "@node-rs/argon2";

const passwordOptions = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

export function hashPassword(password: string) {
  return hash(password, passwordOptions);
}

export function verifyPassword({
  hash: passwordHash,
  password,
}: {
  hash: string;
  password: string;
}) {
  return verify(passwordHash, password, passwordOptions);
}
