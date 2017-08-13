SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


CREATE DATABASE IF NOT EXISTS `adaptive_rating` DEFAULT CHARACTER SET utf8 COLLATE utf8_unicode_ci;
USE `adaptive_rating`;

CREATE TABLE IF NOT EXISTS `cache` (
  `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `course` int(11) NOT NULL,
  `user` int(11) NOT NULL,
  `exp` int(11) NOT NULL,
  `updated_at` date NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

CREATE TABLE IF NOT EXISTS `submissions` (
  `course` int(11) NOT NULL,
  `user` int(11) NOT NULL,
  `exp` int(11) NOT NULL,
  `id` int(11) NOT NULL PRIMARY KEY,
  `status` text COLLATE utf8_unicode_ci NOT NULL,
  `updated_at` date NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

GRANT ALL PRIVILEGES ON *.* TO 'dev'@'%';