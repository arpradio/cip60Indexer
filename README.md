<img width="666" alt="psyencelab" src="https://github.com/user-attachments/assets/e1d10ccd-a411-4d85-9fb0-549f6ca36bcd" />

#                                           ArpRadio | CIP-60 Indexer
Music Token (CIP-60 compliant) indexing tool for the Cardano blockchain using Ogmios and Postgres

**Requirements**
   1.  <a href="https://git-scm.com/">Git</a> for pulling repos
   2.  <a href="https://nodejs.org/en">NodeJs</a>  (v18 or higher)
   3.  A Postgres database (create scripts for the needed tables are provided)
   4.  Ogmios - either as standalone (for remote node connection) or cardano-node-ogmios build.
  

   The process is requires two database tables: one to store token information, and another to store sync states.  The process can be interrupted and resumed.


Start off by running 

```git clone https://github.com/arpradio/cip60Indexer.git```

then change to working directory

```cd cip60Indexer```

install dependancies 

```npm i ```

Next, create your <a href="https://github.com/arpradio/cip60Indexer/blob/main/cip60.sql">PostgreSQL Database</a> using the scripts provided.  *If you are using <a href="https://www.pgadmin.org/download">pgAdmin</a>, make sure to manually create the database, ignoring the first two statements listed in the script*.  

Edit the .env file to configure the PostgreSQL database and Ogmios 

In Linux: 

```sudo nano .env```

*In Windows, the .env can be opened with any text editor*

Provide your values for the following.  *Make sure to include the port number in the Ogmiso URI!!!*
```
OGMIOS_URI=ws://<ogmiosURL:port>
DB_HOST=localhost
DB_PASSWORD=<PostgresPassword>
DB_NAME=<PostgresDB>
```
Finally, run 

```npm run dev```









