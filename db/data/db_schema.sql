SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


CREATE DATABASE IF NOT EXISTS `adaptive_rating` DEFAULT CHARACTER SET utf8 COLLATE utf8_unicode_ci;
USE `adaptive_rating`;

CREATE TABLE IF NOT EXISTS `cache` (
  `id` int(11) NOT NULL,
  `course` int(11) NOT NULL,
  `user` int(11) NOT NULL,
  `exp` int(11) NOT NULL,
  `updated_at` date NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

CREATE TABLE IF NOT EXISTS `submissions` (
  `course` int(11) NOT NULL,
  `user` int(11) NOT NULL,
  `exp` int(11) NOT NULL,
  `id` int(11) NOT NULL,
  `status` text COLLATE utf8_unicode_ci NOT NULL,
  `updated_at` date NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

ALTER TABLE `cache`
  ADD PRIMARY KEY (`id`);

ALTER TABLE `submissions`
  ADD PRIMARY KEY (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

