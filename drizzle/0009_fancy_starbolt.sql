ALTER TABLE "voices" ALTER COLUMN "snippet" SET DATA TYPE bytea USING snippet::bytea;
