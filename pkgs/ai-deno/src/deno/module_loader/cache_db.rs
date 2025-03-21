// Copyright 2018-2025 the Deno authors. MIT license.

use std::hash::Hasher;

/// A very fast insecure hasher that uses the xxHash algorithm.
#[derive(Debug, Clone)]
pub struct FastInsecureHasher(twox_hash::XxHash64);

impl FastInsecureHasher {
    pub fn new_without_deno_version() -> Self {
        Self(Default::default())
    }

    pub fn new_deno_versioned() -> Self {
        let mut hasher = Self::new_without_deno_version();
        hasher.write_str("ai-deno-v0");
        hasher
    }

    pub fn write_str(&mut self, text: &str) -> &mut Self {
        self.write(text.as_bytes());
        self
    }

    pub fn write(&mut self, bytes: &[u8]) -> &mut Self {
        self.0.write(bytes);
        self
    }

    pub fn write_u8(&mut self, value: u8) -> &mut Self {
        self.0.write_u8(value);
        self
    }

    pub fn write_u64(&mut self, value: u64) -> &mut Self {
        self.0.write_u64(value);
        self
    }

    pub fn write_hashable(&mut self, hashable: impl std::hash::Hash) -> &mut Self {
        hashable.hash(&mut self.0);
        self
    }

    pub fn finish(&self) -> u64 {
        self.0.finish()
    }
}

#[derive(Debug, Copy, Clone, PartialEq, Eq, Hash)]
pub struct CacheDBHash(u64);

impl CacheDBHash {
    pub fn new(hash: u64) -> Self {
        Self(hash)
    }

    pub fn from_hashable(hashable: impl std::hash::Hash) -> Self {
        Self::new(
            // always write in the deno version just in case
            // the clearing on deno version change doesn't work
            FastInsecureHasher::new_deno_versioned()
                .write_hashable(hashable)
                .finish(),
        )
    }
}
